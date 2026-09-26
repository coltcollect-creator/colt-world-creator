
ALTER TABLE public.npc_appearances
  ADD COLUMN IF NOT EXISTS sprite_left_url TEXT,
  ADD COLUMN IF NOT EXISTS sprite_right_url TEXT,
  ADD COLUMN IF NOT EXISTS sprite_jump_url TEXT;
