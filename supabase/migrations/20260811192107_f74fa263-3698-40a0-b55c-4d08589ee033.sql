-- 1. Remove anon EXECUTE on SECURITY DEFINER auction functions
REVOKE EXECUTE ON FUNCTION public.cancel_auction(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_auction_bid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.settle_auction(uuid) FROM anon;

-- 2. chat_messages: allow only soft-delete flag changes by the author
CREATE OR REPLACE FUNCTION public.tg_chat_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_owner() THEN
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id
     OR NEW.user_id <> OLD.user_id
     OR NEW.channel <> OLD.channel
     OR NEW.message <> OLD.message
     OR NEW.created_at <> OLD.created_at
     OR COALESCE(NEW.recipient_id::text,'') <> COALESCE(OLD.recipient_id::text,'')
     OR COALESCE(NEW.deleted_by::text,'') <> COALESCE(OLD.deleted_by::text,'') THEN
    RAISE EXCEPTION 'Only the deleted flag may be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_chat_guard_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_guard_update ON public.chat_messages;
CREATE TRIGGER chat_guard_update
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_chat_guard_update();

-- 3. map versions / objects: only published content is readable by players
DROP POLICY IF EXISTS mv_read_non_archived ON public.map_versions;
CREATE POLICY mv_read_published ON public.map_versions
FOR SELECT USING (status = 'published' OR public.is_owner());

DROP POLICY IF EXISTS mo_read_non_archived ON public.map_objects;
CREATE POLICY mo_read_published ON public.map_objects
FOR SELECT USING (
  public.is_owner() OR EXISTS (
    SELECT 1 FROM public.map_versions v
    WHERE v.id = map_objects.map_version_id AND v.status = 'published'
  )
);

-- 4. player_quests: no direct player writes; RPCs only
DROP POLICY IF EXISTS pq_insert_own ON public.player_quests;
DROP POLICY IF EXISTS pq_update_own ON public.player_quests;
REVOKE INSERT, UPDATE ON public.player_quests FROM authenticated;
