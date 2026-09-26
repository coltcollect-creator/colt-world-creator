ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS model_3d_url text;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS model_3d_url text;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS floor_type text NOT NULL DEFAULT 'grass';
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS floor_color text;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS floor_texture_url text;