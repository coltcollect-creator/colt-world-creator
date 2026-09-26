
-- Restrict map_versions SELECT to published versions or owner
DROP POLICY IF EXISTS mv_read_available ON public.map_versions;
CREATE POLICY mv_read_published ON public.map_versions
  FOR SELECT
  USING (status = 'published' OR public.is_owner());

-- Restrict map_objects SELECT to objects that belong to published versions or owner
DROP POLICY IF EXISTS mo_read_available ON public.map_objects;
CREATE POLICY mo_read_published ON public.map_objects
  FOR SELECT
  USING (
    public.is_owner() OR EXISTS (
      SELECT 1 FROM public.map_versions v
      WHERE v.id = map_objects.map_version_id
        AND v.status = 'published'
    )
  );
