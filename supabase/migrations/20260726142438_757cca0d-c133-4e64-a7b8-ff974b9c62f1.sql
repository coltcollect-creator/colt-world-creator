
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.email_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_verifications TO authenticated;
GRANT ALL ON public.email_verifications TO service_role;

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_verification_select" ON public.email_verifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Issue a new 6-digit code for the current user; returns the code so the caller can email it.
CREATE OR REPLACE FUNCTION public.issue_email_verification_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  _code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  INSERT INTO public.email_verifications (user_id, code, expires_at, attempts, created_at)
  VALUES (_uid, _code, now() + interval '15 minutes', 0, now())
  ON CONFLICT (user_id) DO UPDATE
    SET code = EXCLUDED.code,
        expires_at = EXCLUDED.expires_at,
        attempts = 0,
        created_at = now();
  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_email_verification_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_email_verification_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_email_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.email_verifications%rowtype;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO _row FROM public.email_verifications WHERE user_id = _uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code');
  END IF;
  IF _row.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF _row.attempts >= 6 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  END IF;
  IF _row.code <> _code THEN
    UPDATE public.email_verifications SET attempts = attempts + 1 WHERE user_id = _uid;
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  UPDATE public.profiles SET email_verified = true WHERE id = _uid;
  DELETE FROM public.email_verifications WHERE user_id = _uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_email_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_email_code(text) TO authenticated;
