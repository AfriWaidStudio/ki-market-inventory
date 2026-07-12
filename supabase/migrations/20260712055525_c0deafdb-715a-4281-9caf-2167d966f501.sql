CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text,
  password_hash text,
  smai_id text UNIQUE,
  smai_verified_at timestamptz,
  smai_verification_status text NOT NULL DEFAULT 'pending' CHECK (smai_verification_status IN ('pending','verified','flagged','revoked')),
  smai_verification_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_email_normalized CHECK (email = lower(trim(email))),
  CONSTRAINT app_users_email_unique UNIQUE (email)
);

CREATE OR REPLACE FUNCTION public.generate_smai_id()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
  taken boolean;
BEGIN
  LOOP
    candidate := 'SMAI-';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.app_users WHERE smai_id = candidate) INTO taken;
    EXIT WHEN NOT taken;
  END LOOP;
  RETURN candidate;
END $$;
REVOKE ALL ON FUNCTION public.generate_smai_id() FROM PUBLIC, anon, authenticated;

INSERT INTO public.app_users (id, email, display_name, smai_id, created_at)
SELECT u.id, lower(u.email), COALESCE(u.raw_user_meta_data->>'display_name', u.email), public.generate_smai_id(), u.created_at
FROM auth.users u WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.app_users SET smai_id = public.generate_smai_id() WHERE smai_id IS NULL;
ALTER TABLE public.app_users ALTER COLUMN smai_id SET NOT NULL;

CREATE TABLE public.auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('password','google')),
  provider_subject text NOT NULL,
  provider_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_subject),
  UNIQUE(provider, user_id)
);

INSERT INTO public.auth_identities (user_id, provider, provider_subject, provider_email, metadata)
SELECT i.user_id, 'google', i.identity_data->>'sub', lower(i.identity_data->>'email'), i.identity_data
FROM auth.identities i
WHERE i.provider = 'google' AND i.identity_data->>'sub' IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_active_token_idx ON public.auth_sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_user_idx ON public.auth_sessions(user_id);

CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Repoint direct auth.users foreign keys held by PUBLIC schema tables only.
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT n.nspname schema_name, c.relname table_name, con.conname constraint_name,
           a.attname column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace refn ON refn.oid = ref.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY cols(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = cols.attnum
    WHERE con.contype = 'f' AND refn.nspname = 'auth' AND ref.relname = 'users'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', item.schema_name, item.table_name, item.constraint_name);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.app_users(id) ON DELETE CASCADE',
      item.schema_name, item.table_name, item.constraint_name, item.column_name);
  END LOOP;
END $$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.app_users, public.auth_identities, public.auth_sessions, public.password_reset_tokens TO service_role;
REVOKE ALL ON public.app_users, public.auth_identities, public.auth_sessions, public.password_reset_tokens FROM anon, authenticated;