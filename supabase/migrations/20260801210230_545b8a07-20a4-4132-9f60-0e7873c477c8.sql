DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
 RETURNS TABLE(id uuid, username text, display_name text, avatar_config jsonb, character_id uuid, level integer, xp integer, active_title_id uuid, current_map_id uuid, last_x real, last_y real, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.username, p.display_name, p.avatar_config, p.character_id, p.level, p.xp,
         p.active_title_id, p.current_map_id, p.last_x, p.last_y, p.created_at
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$function$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated, service_role;