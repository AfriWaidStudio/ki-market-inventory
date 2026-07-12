ALTER TABLE public.app_users
  ALTER COLUMN smai_id SET DEFAULT public.generate_smai_id();

CREATE OR REPLACE FUNCTION public.ki_verify_user(_user_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.app_users
    SET smai_verification_status = 'verified',
        smai_verified_at = now(),
        smai_verification_notes = smai_verification_notes || jsonb_build_object('at', now(), 'note', _note),
        updated_at = now()
  WHERE id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.ki_verify_user(uuid, text) FROM PUBLIC, anon, authenticated;