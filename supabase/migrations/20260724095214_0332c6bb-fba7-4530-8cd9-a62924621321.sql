DROP POLICY IF EXISTS "maps_read_active" ON public.maps;
CREATE POLICY "maps_read_non_archived"
ON public.maps
FOR SELECT
TO authenticated
USING (NOT is_archived OR public.is_owner());

DROP POLICY IF EXISTS "mv_read_published" ON public.map_versions;
CREATE POLICY "mv_read_available"
ON public.map_versions
FOR SELECT
TO authenticated
USING (status <> 'archived' OR public.is_owner());