
ALTER TABLE public.game_settings
  ADD COLUMN IF NOT EXISTS email_verification_required boolean NOT NULL DEFAULT true;

-- Backfill: any existing owner is auto-verified.
UPDATE public.profiles p
   SET email_verified = true
  FROM public.user_roles ur
 WHERE ur.user_id = p.id
   AND ur.role = 'owner'::public.app_role
   AND p.email_verified = false;

-- Trigger: whenever a user is granted the owner role, auto-verify their email.
CREATE OR REPLACE FUNCTION public.tg_auto_verify_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'owner'::public.app_role THEN
    UPDATE public.profiles SET email_verified = true WHERE id = NEW.user_id;
    DELETE FROM public.email_verifications WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_auto_verify_owner ON public.user_roles;
CREATE TRIGGER user_roles_auto_verify_owner
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_verify_owner();
