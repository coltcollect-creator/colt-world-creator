
-- Normalize: keep at most one active non-archived map (earliest created wins)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.maps WHERE is_active = true AND is_archived = false
)
UPDATE public.maps m SET is_active = false
FROM ranked r WHERE m.id = r.id AND r.rn > 1;

-- Partial unique index to enforce single main map
CREATE UNIQUE INDEX IF NOT EXISTS maps_single_main_idx
  ON public.maps ((true))
  WHERE is_active = true AND is_archived = false;

-- Owner-only RPC to set the main map atomically
CREATE OR REPLACE FUNCTION public.set_main_map(_map_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.maps SET is_active = false WHERE is_active = true AND id <> _map_id;
  UPDATE public.maps SET is_active = true, is_archived = false WHERE id = _map_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_main_map(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_main_map(uuid) TO authenticated;
