
-- Drop uniqueness constraint that limits to one main map
DROP INDEX IF EXISTS public.maps_single_main_idx;

-- Revert RLS: allow reading any non-archived map version and its objects
DROP POLICY IF EXISTS mv_read_published ON public.map_versions;
CREATE POLICY mv_read_non_archived ON public.map_versions
  FOR SELECT USING (status <> 'archived' OR public.is_owner());

DROP POLICY IF EXISTS mo_read_published ON public.map_objects;
CREATE POLICY mo_read_non_archived ON public.map_objects
  FOR SELECT USING (
    public.is_owner() OR EXISTS (
      SELECT 1 FROM public.map_versions v
      WHERE v.id = map_objects.map_version_id AND v.status <> 'archived'
    )
  );
