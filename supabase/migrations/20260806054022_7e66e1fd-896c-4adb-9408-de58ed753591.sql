-- ============ 1. CROSS-BORDER PAYMENT INTELLIGENCE ============
CREATE TABLE public.corridor_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  send_currency text NOT NULL,
  receive_currency text NOT NULL,
  typical_amount numeric NOT NULL DEFAULT 1000,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, send_currency, receive_currency)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corridor_watchlist TO authenticated;
GRANT ALL ON public.corridor_watchlist TO service_role;
ALTER TABLE public.corridor_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own corridor watchlist" ON public.corridor_watchlist FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.corridor_quotes (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  send_currency text NOT NULL,
  receive_currency text NOT NULL,
  provider text NOT NULL,
  provider_type text NOT NULL DEFAULT 'fintech',
  fx_rate numeric NOT NULL,
  mid_market_rate numeric,
  fee_flat numeric NOT NULL DEFAULT 0,
  fee_pct numeric NOT NULL DEFAULT 0,
  min_amount numeric,
  max_amount numeric,
  speed_hours numeric,
  payout_method text,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_corridor_quotes_lookup ON public.corridor_quotes (user_id, send_currency, receive_currency, observed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corridor_quotes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.corridor_quotes_id_seq TO authenticated;
GRANT ALL ON public.corridor_quotes TO service_role;
GRANT ALL ON SEQUENCE public.corridor_quotes_id_seq TO service_role;
ALTER TABLE public.corridor_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own corridor quotes" ON public.corridor_quotes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.corridor_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  send_currency text NOT NULL,
  receive_currency text NOT NULL,
  provider text NOT NULL,
  amount_sent numeric NOT NULL,
  amount_received numeric NOT NULL,
  effective_rate numeric NOT NULL,
  total_cost numeric NOT NULL DEFAULT 0,
  baseline_rate numeric,
  saved_vs_baseline numeric,
  purpose text,
  notes text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_corridor_transfers_user ON public.corridor_transfers (user_id, sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corridor_transfers TO authenticated;
GRANT ALL ON public.corridor_transfers TO service_role;
ALTER TABLE public.corridor_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own corridor transfers" ON public.corridor_transfers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ 7. E-COMMERCE / RETAIL ARBITRAGE ============
CREATE TABLE public.retail_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  sku text,
  target_margin_pct numeric NOT NULL DEFAULT 0.15,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retail_products TO authenticated;
GRANT ALL ON public.retail_products TO service_role;
ALTER TABLE public.retail_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own retail products" ON public.retail_products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_retail_products_updated BEFORE UPDATE ON public.retail_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.retail_listings (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  role text NOT NULL DEFAULT 'source',
  url text,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  shipping_cost numeric NOT NULL DEFAULT 0,
  marketplace_fee_pct numeric NOT NULL DEFAULT 0,
  in_stock boolean NOT NULL DEFAULT true,
  seller_rating numeric,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_retail_listings_product ON public.retail_listings (user_id, product_id, observed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retail_listings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.retail_listings_id_seq TO authenticated;
GRANT ALL ON public.retail_listings TO service_role;
GRANT ALL ON SEQUENCE public.retail_listings_id_seq TO service_role;
ALTER TABLE public.retail_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own retail listings" ON public.retail_listings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ 8. SAAS SPEND & VENDOR MANAGEMENT ============
CREATE TABLE public.saas_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  website text,
  owner_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_vendors TO authenticated;
GRANT ALL ON public.saas_vendors TO service_role;
ALTER TABLE public.saas_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saas vendors" ON public.saas_vendors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.saas_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.saas_vendors(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'Standard',
  seats integer NOT NULL DEFAULT 1,
  active_seats integer,
  unit_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  renewal_date date,
  auto_renew boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  cancellation_notice_days integer NOT NULL DEFAULT 30,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_saas_subs_user ON public.saas_subscriptions (user_id, renewal_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_subscriptions TO authenticated;
GRANT ALL ON public.saas_subscriptions TO service_role;
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saas subs" ON public.saas_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_saas_subs_updated BEFORE UPDATE ON public.saas_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.saas_price_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.saas_subscriptions(id) ON DELETE CASCADE,
  old_amount numeric NOT NULL,
  new_amount numeric NOT NULL,
  effective_date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_saas_price_events_sub ON public.saas_price_events (user_id, subscription_id, effective_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_price_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.saas_price_events_id_seq TO authenticated;
GRANT ALL ON public.saas_price_events TO service_role;
GRANT ALL ON SEQUENCE public.saas_price_events_id_seq TO service_role;
ALTER TABLE public.saas_price_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saas price events" ON public.saas_price_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ 9. FREIGHT / SUPPLY CHAIN INTELLIGENCE ============
CREATE TABLE public.freight_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  origin text NOT NULL,
  destination text NOT NULL,
  mode text NOT NULL DEFAULT 'ocean',
  equipment text NOT NULL DEFAULT '40ft',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, origin, destination, mode, equipment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_lanes TO authenticated;
GRANT ALL ON public.freight_lanes TO service_role;
ALTER TABLE public.freight_lanes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own freight lanes" ON public.freight_lanes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.freight_rates (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  lane_id uuid NOT NULL REFERENCES public.freight_lanes(id) ON DELETE CASCADE,
  carrier text NOT NULL,
  base_rate numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  surcharges numeric NOT NULL DEFAULT 0,
  transit_days integer,
  valid_until date,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_freight_rates_lane ON public.freight_rates (user_id, lane_id, observed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_rates TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.freight_rates_id_seq TO authenticated;
GRANT ALL ON public.freight_rates TO service_role;
GRANT ALL ON SEQUENCE public.freight_rates_id_seq TO service_role;
ALTER TABLE public.freight_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own freight rates" ON public.freight_rates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.freight_duty_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  hs_code text NOT NULL,
  description text,
  destination_country text NOT NULL,
  duty_pct numeric NOT NULL DEFAULT 0,
  vat_pct numeric NOT NULL DEFAULT 0,
  other_fees_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hs_code, destination_country)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_duty_profiles TO authenticated;
GRANT ALL ON public.freight_duty_profiles TO service_role;
ALTER TABLE public.freight_duty_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own duty profiles" ON public.freight_duty_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ 10. WHITE-LABEL DATA API ============
CREATE TABLE public.data_api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['p2p.read']::text[],
  rate_limit_per_min integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_api_clients TO authenticated;
GRANT ALL ON public.data_api_clients TO service_role;
ALTER TABLE public.data_api_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api clients" ON public.data_api_clients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.data_api_usage (
  id bigserial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.data_api_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  status_code integer NOT NULL,
  response_ms integer,
  called_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_usage_client ON public.data_api_usage (user_id, client_id, called_at DESC);
GRANT SELECT ON public.data_api_usage TO authenticated;
GRANT ALL ON public.data_api_usage TO service_role;
GRANT ALL ON SEQUENCE public.data_api_usage_id_seq TO service_role;
ALTER TABLE public.data_api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api usage" ON public.data_api_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);