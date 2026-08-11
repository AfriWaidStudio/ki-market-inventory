
-- ============ SmaiBeing registry ============
CREATE TABLE public.smai_beings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code int NOT NULL UNIQUE,
  name text NOT NULL,
  domain text NOT NULL,
  purpose text NOT NULL,
  origin text NOT NULL DEFAULT 'waides.konsmik.com',
  tred_beings text[] NOT NULL DEFAULT '{}',
  onyix_cost numeric NOT NULL DEFAULT 5,
  is_commander boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.smai_beings TO authenticated, anon;
GRANT ALL ON public.smai_beings TO service_role;
ALTER TABLE public.smai_beings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beings readable" ON public.smai_beings FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER trg_smai_beings_updated BEFORE UPDATE ON public.smai_beings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Onyix wallet ============
CREATE TABLE public.onyix_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  smaisika_balance numeric NOT NULL DEFAULT 0,
  onyix_tank numeric NOT NULL DEFAULT 250,
  lifetime_consumed numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.onyix_wallets TO authenticated;
GRANT ALL ON public.onyix_wallets TO service_role;
ALTER TABLE public.onyix_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet" ON public.onyix_wallets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_onyix_wallets_updated BEFORE UPDATE ON public.onyix_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Onyix ledger ============
CREATE TABLE public.onyix_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  onyix_delta numeric NOT NULL DEFAULT 0,
  smaisika_delta numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'webonyix',
  reason text NOT NULL,
  being_code int,
  tank_after numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.onyix_ledger TO authenticated;
GRANT ALL ON public.onyix_ledger TO service_role;
ALTER TABLE public.onyix_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger" ON public.onyix_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ledger insert" ON public.onyix_ledger FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_onyix_ledger_user ON public.onyix_ledger(user_id, created_at DESC);

-- ============ Hired beings ============
CREATE TABLE public.smai_employments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  being_code int NOT NULL,
  employed_at timestamptz NOT NULL DEFAULT now(),
  runs int NOT NULL DEFAULT 0,
  onyix_spent numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, being_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smai_employments TO authenticated;
GRANT ALL ON public.smai_employments TO service_role;
ALTER TABLE public.smai_employments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own employments" ON public.smai_employments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_smai_employments_updated BEFORE UPDATE ON public.smai_employments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Assemblies ============
CREATE TABLE public.smai_assemblies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  being_codes int[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'complete',
  answer text,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  onyix_consumed numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smai_assemblies TO authenticated;
GRANT ALL ON public.smai_assemblies TO service_role;
ALTER TABLE public.smai_assemblies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assemblies" ON public.smai_assemblies FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_smai_assemblies_updated BEFORE UPDATE ON public.smai_assemblies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WaidesPruf ============
CREATE TABLE public.waidespruf_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  subject_kind text NOT NULL DEFAULT 'price',
  claim text NOT NULL,
  verification_level text NOT NULL DEFAULT 'community_reported',
  confidence numeric NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  sources int NOT NULL DEFAULT 1,
  being_code int,
  onyix_consumed numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.waidespruf_records TO authenticated;
GRANT ALL ON public.waidespruf_records TO service_role;
ALTER TABLE public.waidespruf_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pruf readable" ON public.waidespruf_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "pruf own insert" ON public.waidespruf_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_pruf_created ON public.waidespruf_records(created_at DESC);
