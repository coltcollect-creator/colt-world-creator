DROP POLICY IF EXISTS "mo_read" ON public.map_objects;
CREATE POLICY "mo_read_available"
ON public.map_objects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.map_versions v
    WHERE v.id = map_version_id
      AND (v.status <> 'archived' OR public.is_owner())
  )
);