
-- 1. Profiles: restrict SELECT to self + owner; expose safe columns via a view.
DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, username, display_name, avatar_config, level, xp, active_title_id, current_map_id, last_x, last_y, created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2. Profiles: prevent client-side privilege / credit escalation via trigger.
CREATE OR REPLACE FUNCTION public.tg_profiles_guard_sensitive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_owner() OR auth.uid() IS NULL THEN
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
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_profiles_guard_sensitive() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS profiles_guard_sensitive ON public.profiles;
CREATE TRIGGER profiles_guard_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_guard_sensitive();

-- Also tighten UPDATE policy: remove the ineffective subquery check.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. active_players: scope reads to same public room + self.
DROP POLICY IF EXISTS "Active players readable" ON public.active_players;
DROP POLICY IF EXISTS ap_read ON public.active_players;
CREATE POLICY ap_read_scoped ON public.active_players FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.is_owner()
  OR EXISTS (SELECT 1 FROM public.maps m WHERE m.id = active_players.map_id AND m.is_public_room = true)
);

-- 4. chat_messages: allow authors to soft-delete their own messages.
CREATE POLICY chat_delete_own_soft ON public.chat_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. Storage: restrict assets bucket write policies to owner; drop anon read.
DROP POLICY IF EXISTS "assets read all" ON storage.objects;
DROP POLICY IF EXISTS "assets insert auth" ON storage.objects;
DROP POLICY IF EXISTS "assets update auth" ON storage.objects;
DROP POLICY IF EXISTS "assets delete auth" ON storage.objects;

CREATE POLICY "assets read own or owner" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assets' AND (owner = auth.uid() OR public.is_owner()));
CREATE POLICY "assets insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets' AND owner = auth.uid());
CREATE POLICY "assets update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assets' AND (owner = auth.uid() OR public.is_owner()))
  WITH CHECK (bucket_id = 'assets' AND (owner = auth.uid() OR public.is_owner()));
CREATE POLICY "assets delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assets' AND (owner = auth.uid() OR public.is_owner()));

-- 6. SECURITY DEFINER functions: revoke from anon (and internal ones from authenticated).
REVOKE EXECUTE ON FUNCTION public.buy_and_equip_cosmetic(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_quest_reward(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_gem_pack(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_order_delivered(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.open_mystery_box(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.progress_quest(text, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_cosmetic(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_bulk_delivery(uuid[], text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_delivery(uuid, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spin_wheel(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_bump_conversation() FROM anon, authenticated, PUBLIC;
