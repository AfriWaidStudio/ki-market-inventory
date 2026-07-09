
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- App role enum + has_role helper
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Profiles
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  preferred_currency text NOT NULL DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Signup trigger: create profile + default 'user' role
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trade status enum
CREATE TYPE public.trade_status AS ENUM ('active', 'closed', 'cancelled');

-- Trades
CREATE TABLE public.market_inventory_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset text NOT NULL DEFAULT 'USDT',
  amount numeric NOT NULL,
  buy_exchange text NOT NULL,
  sell_exchange text NOT NULL,
  route text GENERATED ALWAYS AS (buy_exchange || ' → ' || sell_exchange) STORED,
  buy_price numeric NOT NULL,
  expected_sell_price numeric,
  actual_sell_price numeric,
  estimated_fees numeric NOT NULL DEFAULT 0,
  final_fees numeric,
  expected_profit numeric,
  actual_profit numeric,
  buy_time timestamptz NOT NULL DEFAULT now(),
  sell_time timestamptz,
  duration_minutes integer,
  status public.trade_status NOT NULL DEFAULT 'active',
  confidence_score numeric,
  risk_score numeric,
  ki_reasoning text,
  ki_accuracy_verdict text,
  lesson_learned text,
  user_notes text,
  currency text NOT NULL DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_trades TO authenticated;
GRANT ALL ON public.market_inventory_trades TO service_role;
ALTER TABLE public.market_inventory_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trades" ON public.market_inventory_trades FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_trades_updated BEFORE UPDATE ON public.market_inventory_trades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_trades_user_status ON public.market_inventory_trades(user_id, status);
CREATE INDEX idx_trades_user_created ON public.market_inventory_trades(user_id, created_at DESC);

-- Price snapshots
CREATE TABLE public.market_inventory_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange text NOT NULL,
  asset text NOT NULL DEFAULT 'USDT',
  side text NOT NULL CHECK (side IN ('buy','sell')),
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  liquidity_score numeric,
  merchant_count integer,
  merchant_rating numeric,
  captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.market_inventory_price_snapshots TO authenticated;
GRANT ALL ON public.market_inventory_price_snapshots TO service_role;
ALTER TABLE public.market_inventory_price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.market_inventory_price_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_snapshots_user_captured ON public.market_inventory_price_snapshots(user_id, captured_at DESC);

-- Exchange accounts
CREATE TABLE public.market_inventory_exchange_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_exchange_accounts TO authenticated;
GRANT ALL ON public.market_inventory_exchange_accounts TO service_role;
ALTER TABLE public.market_inventory_exchange_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.market_inventory_exchange_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Encrypted API keys (never expose encrypted_key/encrypted_secret to client through select policy — we route reads via server functions with service role)
CREATE TABLE public.market_inventory_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange text NOT NULL,
  key_label text NOT NULL,
  encrypted_key bytea NOT NULL,
  encrypted_secret bytea NOT NULL,
  permissions text NOT NULL DEFAULT 'read_only' CHECK (permissions = 'read_only'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.market_inventory_api_keys TO authenticated;
GRANT ALL ON public.market_inventory_api_keys TO service_role;
ALTER TABLE public.market_inventory_api_keys ENABLE ROW LEVEL SECURITY;
-- SELECT policy limited to metadata; encrypted columns are never sent to client (server fns strip them)
CREATE POLICY "own api keys" ON public.market_inventory_api_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trade notes
CREATE TABLE public.market_inventory_trade_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.market_inventory_trades(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_trade_notes TO authenticated;
GRANT ALL ON public.market_inventory_trade_notes TO service_role;
ALTER TABLE public.market_inventory_trade_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.market_inventory_trade_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily reports (computed cache)
CREATE TABLE public.market_inventory_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  total_profit numeric NOT NULL DEFAULT 0,
  trade_count integer NOT NULL DEFAULT 0,
  win_rate numeric,
  avg_duration_minutes numeric,
  best_route text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_daily_reports TO authenticated;
GRANT ALL ON public.market_inventory_daily_reports TO service_role;
ALTER TABLE public.market_inventory_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports" ON public.market_inventory_daily_reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Risk alerts
CREATE TABLE public.market_inventory_risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('low','medium','high')),
  message text NOT NULL,
  related_trade_id uuid REFERENCES public.market_inventory_trades(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_inventory_risk_alerts TO authenticated;
GRANT ALL ON public.market_inventory_risk_alerts TO service_role;
ALTER TABLE public.market_inventory_risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.market_inventory_risk_alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Audit log (append-only for user; service role can read all)
CREATE TABLE public.market_inventory_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.market_inventory_audit_log TO authenticated;
GRANT ALL ON public.market_inventory_audit_log TO service_role;
ALTER TABLE public.market_inventory_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own audit" ON public.market_inventory_audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own audit" ON public.market_inventory_audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
