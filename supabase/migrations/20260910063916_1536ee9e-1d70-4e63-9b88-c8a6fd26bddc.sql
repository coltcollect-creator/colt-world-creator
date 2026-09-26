CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.internal_cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_cron_tokens TO service_role;
ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;
-- no policies: only service_role (bypasses RLS) may read this table

INSERT INTO public.internal_cron_tokens (name) VALUES ('owner_alerts')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_owner_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  tok text;
  payload jsonb;
BEGIN
  SELECT token INTO tok FROM public.internal_cron_tokens WHERE name = 'owner_alerts';
  IF tok IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_ARGV[0] = 'message' AND coalesce(NEW.sender_role, '') <> 'user' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object('type', TG_ARGV[0], 'id', NEW.id::text);

  PERFORM net.http_post(
    url := 'https://project--2b94da4e-3d77-49bf-a5a7-0c5c3e0e7d59.lovable.app/api/public/owner-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', tok),
    body := payload,
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_owner_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tg_notify_owner_new_user ON public.profiles;
CREATE TRIGGER tg_notify_owner_new_user
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_event('new_user');

DROP TRIGGER IF EXISTS tg_notify_owner_new_message ON public.conversation_messages;
CREATE TRIGGER tg_notify_owner_new_message
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_event('message');

DROP TRIGGER IF EXISTS tg_notify_owner_new_order ON public.orders;
CREATE TRIGGER tg_notify_owner_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_event('order');