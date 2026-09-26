ALTER TABLE public.maps
  ADD COLUMN IF NOT EXISTS dimension text NOT NULL DEFAULT '2d';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maps_dimension_check'
  ) THEN
    ALTER TABLE public.maps
      ADD CONSTRAINT maps_dimension_check CHECK (dimension IN ('2d','3d'));
  END IF;
END $$;

UPDATE public.maps SET dimension = '2d' WHERE dimension IS NULL OR dimension NOT IN ('2d','3d');

ALTER TABLE public.map_objects
  ADD COLUMN IF NOT EXISTS depth real NOT NULL DEFAULT 0;