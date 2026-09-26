
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_config jsonb,
  level int, xp int, active_title_id uuid, current_map_id uuid,
  last_x real, last_y real, created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_config, p.level, p.xp,
         p.active_title_id, p.current_map_id, p.last_x, p.last_y, p.created_at
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_public_profiles(_prefix text, _limit int DEFAULT 20)
RETURNS TABLE (id uuid, username text, display_name text, level int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.level
  FROM public.profiles p
  WHERE p.username ILIKE _prefix || '%'
  ORDER BY p.username
  LIMIT LEAST(GREATEST(_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION public.search_public_profiles(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, int) TO authenticated;
