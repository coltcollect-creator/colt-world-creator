CREATE OR REPLACE FUNCTION public.tg_profiles_guard_sensitive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_owner() OR auth.uid() IS NULL OR COALESCE(current_setting('app.credit_op', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  NEW.credits := OLD.credits;
  NEW.xp := OLD.xp;
  NEW.level := OLD.level;
  NEW.is_suspended := OLD.is_suspended;
  NEW.is_muted := OLD.is_muted;
  NEW.admin_notes := OLD.admin_notes;
  NEW.active_title_id := COALESCE(NEW.active_title_id, OLD.active_title_id);
  RETURN NEW;
END; $function$;

DO $do$
DECLARE r record; def text; newdef text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.prosecdef
      AND (pg_get_functiondef(p.oid) ILIKE '%profiles SET credits%'
           OR pg_get_functiondef(p.oid) ILIKE '%profiles SET xp%'
           OR pg_get_functiondef(p.oid) ILIKE '%profiles SET level%')
  LOOP
    def := pg_get_functiondef(r.oid);
    IF def ILIKE '%app.credit_op%' THEN CONTINUE; END IF;
    newdef := regexp_replace(def, E'\nBEGIN\n', E'\nBEGIN\n  PERFORM set_config(''app.credit_op'', ''1'', true);\n', 1);
    IF newdef <> def THEN
      EXECUTE newdef;
    END IF;
  END LOOP;
END $do$;