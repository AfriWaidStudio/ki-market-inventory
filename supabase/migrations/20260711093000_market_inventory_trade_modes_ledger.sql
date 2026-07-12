CREATE TYPE public.market_inventory_trade_type AS ENUM ('paper', 'manual');
CREATE TYPE public.market_inventory_ledger_entry_type AS ENUM (
  'paper_position_opened',
  'paper_realized_profit',
  'manual_capital_committed',
  'manual_realized_profit',
  'fee_recorded',
  'adjustment'
);

ALTER TABLE public.market_inventory_trades
  ADD COLUMN trade_type public.market_inventory_trade_type NOT NULL DEFAULT 'manual',
  ADD COLUMN stage text NOT NULL DEFAULT 'bought',
  ADD COLUMN remaining_amount numeric,
  ADD COLUMN closed_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN realized_profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN total_recorded_fees numeric NOT NULL DEFAULT 0,
  ADD COLUMN last_event_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT market_inventory_trades_stage_check CHECK (
    stage IN (
      'paper_active',
      'paper_closed',
      'bought',
      'awaiting_transfer',
      'received',
      'listed_for_sale',
      'awaiting_payment',
      'ready_to_close',
      'partially_closed',
      'closed',
      'cancelled'
    )
  );

UPDATE public.market_inventory_trades
SET
  remaining_amount = CASE WHEN status = 'closed' THEN 0 ELSE amount END,
  closed_amount = CASE WHEN status = 'closed' THEN amount ELSE 0 END,
  realized_profit = COALESCE(actual_profit, 0),
  total_recorded_fees = COALESCE(final_fees, estimated_fees, 0),
  stage = CASE
    WHEN status = 'closed' THEN 'closed'
    WHEN status = 'cancelled' THEN 'cancelled'
    ELSE 'bought'
  END
WHERE remaining_amount IS NULL;

ALTER TABLE public.market_inventory_trades
  ALTER COLUMN remaining_amount SET NOT NULL;

CREATE TABLE public.market_inventory_trade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.market_inventory_trades(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_stage text,
  to_stage text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.market_inventory_trade_events TO authenticated;
GRANT ALL ON public.market_inventory_trade_events TO service_role;
ALTER TABLE public.market_inventory_trade_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trade events" ON public.market_inventory_trade_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_trade_events_trade_created ON public.market_inventory_trade_events(trade_id, created_at DESC);
CREATE INDEX idx_trade_events_user_created ON public.market_inventory_trade_events(user_id, created_at DESC);

CREATE TABLE public.market_inventory_trade_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.market_inventory_trades(id) ON DELETE CASCADE,
  fee_type text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_trade_fees TO authenticated;
GRANT ALL ON public.market_inventory_trade_fees TO service_role;
ALTER TABLE public.market_inventory_trade_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trade fees" ON public.market_inventory_trade_fees
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_trade_fees_trade_created ON public.market_inventory_trade_fees(trade_id, created_at DESC);

CREATE TABLE public.market_inventory_capital_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.market_inventory_trades(id) ON DELETE SET NULL,
  trade_type public.market_inventory_trade_type NOT NULL,
  entry_type public.market_inventory_ledger_entry_type NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.market_inventory_capital_ledger TO authenticated;
GRANT ALL ON public.market_inventory_capital_ledger TO service_role;
ALTER TABLE public.market_inventory_capital_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own capital ledger" ON public.market_inventory_capital_ledger
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_capital_ledger_user_created ON public.market_inventory_capital_ledger(user_id, created_at DESC);
CREATE INDEX idx_capital_ledger_trade ON public.market_inventory_capital_ledger(trade_id);

INSERT INTO public.market_inventory_trade_events (
  user_id,
  trade_id,
  event_type,
  to_stage,
  metadata,
  created_at
)
SELECT
  user_id,
  id,
  'legacy_trade_imported',
  stage,
  jsonb_build_object('status', status, 'trade_type', trade_type),
  created_at
FROM public.market_inventory_trades;

INSERT INTO public.market_inventory_capital_ledger (
  user_id,
  trade_id,
  trade_type,
  entry_type,
  amount,
  currency,
  description,
  metadata,
  created_at
)
SELECT
  user_id,
  id,
  trade_type,
  'manual_capital_committed',
  amount * buy_price,
  currency,
  'Backfilled capital committed for existing manual trade',
  jsonb_build_object('amount', amount, 'buy_price', buy_price),
  buy_time
FROM public.market_inventory_trades
WHERE trade_type = 'manual';

INSERT INTO public.market_inventory_capital_ledger (
  user_id,
  trade_id,
  trade_type,
  entry_type,
  amount,
  currency,
  description,
  metadata,
  created_at
)
SELECT
  user_id,
  id,
  trade_type,
  'manual_realized_profit',
  COALESCE(actual_profit, realized_profit, 0),
  currency,
  'Backfilled realized profit for existing closed manual trade',
  jsonb_build_object('source', 'legacy_actual_profit'),
  COALESCE(sell_time, updated_at)
FROM public.market_inventory_trades
WHERE trade_type = 'manual'
  AND status = 'closed'
  AND COALESCE(actual_profit, realized_profit, 0) <> 0;

INSERT INTO public.market_inventory_capital_ledger (
  user_id,
  trade_id,
  trade_type,
  entry_type,
  amount,
  currency,
  description,
  metadata,
  created_at
)
SELECT
  user_id,
  id,
  trade_type,
  'fee_recorded',
  -ABS(COALESCE(final_fees, estimated_fees, 0)),
  currency,
  'Backfilled recorded fee for existing trade',
  jsonb_build_object('source', 'legacy_fee_columns'),
  COALESCE(sell_time, updated_at)
FROM public.market_inventory_trades
WHERE COALESCE(final_fees, estimated_fees, 0) > 0;
