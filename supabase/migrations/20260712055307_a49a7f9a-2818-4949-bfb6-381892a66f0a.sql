CREATE TYPE public.sync_status AS ENUM ('running', 'completed', 'failed');

CREATE TABLE public.market_inventory_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.market_inventory_exchange_accounts(id) ON DELETE SET NULL,
  exchange text NOT NULL,
  status public.sync_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  records_imported integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_message text,
  metadata jsonb
);
GRANT SELECT, INSERT, UPDATE ON public.market_inventory_sync_runs TO authenticated;
GRANT ALL ON public.market_inventory_sync_runs TO service_role;
ALTER TABLE public.market_inventory_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sync runs" ON public.market_inventory_sync_runs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.market_inventory_exchange_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.market_inventory_exchange_accounts(id) ON DELETE SET NULL,
  external_tx_id text NOT NULL,
  asset text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'trade', 'trade_settlement')),
  side text,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  tx_time timestamptz NOT NULL,
  fee numeric DEFAULT 0,
  fee_asset text,
  from_address text,
  to_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.market_inventory_exchange_transactions TO authenticated;
GRANT ALL ON public.market_inventory_exchange_transactions TO service_role;
ALTER TABLE public.market_inventory_exchange_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.market_inventory_exchange_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_exchange_tx_user_time ON public.market_inventory_exchange_transactions(user_id, tx_time DESC);
CREATE INDEX idx_exchange_tx_external_id ON public.market_inventory_exchange_transactions(external_tx_id);

CREATE TABLE public.market_inventory_transaction_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_tx_id uuid REFERENCES public.market_inventory_exchange_transactions(id) ON DELETE SET NULL,
  withdrawal_tx_id uuid REFERENCES public.market_inventory_exchange_transactions(id) ON DELETE SET NULL,
  trade_id uuid REFERENCES public.market_inventory_trades(id) ON DELETE SET NULL,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE(user_id, deposit_tx_id, withdrawal_tx_id)
);
GRANT SELECT, INSERT, UPDATE ON public.market_inventory_transaction_matches TO authenticated;
GRANT ALL ON public.market_inventory_transaction_matches TO service_role;
ALTER TABLE public.market_inventory_transaction_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own matches" ON public.market_inventory_transaction_matches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);