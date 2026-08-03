CREATE TABLE public.market_inventory_fee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  exchange text NOT NULL,
  trade_fee_pct numeric NOT NULL DEFAULT 0,
  payment_fee_pct numeric NOT NULL DEFAULT 0,
  payment_fee_flat numeric NOT NULL DEFAULT 0,
  withdrawal_fee_asset numeric NOT NULL DEFAULT 0,
  network text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exchange)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_fee_profiles TO authenticated;
GRANT ALL ON public.market_inventory_fee_profiles TO service_role;
ALTER TABLE public.market_inventory_fee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fee profiles" ON public.market_inventory_fee_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fee_profiles_updated BEFORE UPDATE ON public.market_inventory_fee_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.market_inventory_spread_history (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  asset text NOT NULL,
  fiat text NOT NULL,
  buy_exchange text NOT NULL,
  sell_exchange text NOT NULL,
  buy_price numeric NOT NULL,
  sell_price numeric NOT NULL,
  executable_buy_price numeric,
  executable_sell_price numeric,
  spread numeric NOT NULL,
  spread_pct numeric NOT NULL,
  net_pct numeric,
  depth_asset numeric,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_spread_history_lookup ON public.market_inventory_spread_history (user_id, asset, fiat, buy_exchange, sell_exchange, observed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_spread_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.market_inventory_spread_history_id_seq TO authenticated;
GRANT ALL ON public.market_inventory_spread_history TO service_role;
GRANT ALL ON SEQUENCE public.market_inventory_spread_history_id_seq TO service_role;
ALTER TABLE public.market_inventory_spread_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spread history" ON public.market_inventory_spread_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.market_inventory_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL,
  link text,
  dedupe_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_notifications_dedupe ON public.market_inventory_notifications (user_id, dedupe_key);
CREATE INDEX idx_notifications_feed ON public.market_inventory_notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_notifications TO authenticated;
GRANT ALL ON public.market_inventory_notifications TO service_role;
ALTER TABLE public.market_inventory_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.market_inventory_notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);