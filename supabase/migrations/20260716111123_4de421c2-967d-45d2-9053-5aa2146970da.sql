
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS is_public_room BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS sprite_left_url TEXT;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS sprite_right_url TEXT;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS offset_x INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS offset_y INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS scale NUMERIC NOT NULL DEFAULT 1;
DROP POLICY IF EXISTS "Active players readable" ON public.active_players;
CREATE POLICY "Active players readable" ON public.active_players FOR SELECT TO authenticated USING (true);
