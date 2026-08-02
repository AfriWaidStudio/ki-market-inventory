CREATE TABLE public.market_inventory_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL DEFAULT 'USDT',
  fiat TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset, fiat)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_watchlist TO authenticated;
GRANT ALL ON public.market_inventory_watchlist TO service_role;
ALTER TABLE public.market_inventory_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist" ON public.market_inventory_watchlist FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.market_inventory_feed_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  exchange TEXT NOT NULL,
  asset TEXT NOT NULL DEFAULT 'USDT',
  fiat TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, exchange, asset, fiat)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_feed_status TO authenticated;
GRANT ALL ON public.market_inventory_feed_status TO service_role;
ALTER TABLE public.market_inventory_feed_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed status" ON public.market_inventory_feed_status FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_price_snapshots_user_pair ON public.market_inventory_price_snapshots (user_id, asset, currency, captured_at DESC);