
-- character_roles
CREATE TABLE public.character_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.character_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_roles TO authenticated;
GRANT ALL ON public.character_roles TO service_role;
ALTER TABLE public.character_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view roles" ON public.character_roles FOR SELECT USING (true);
CREATE POLICY "Owner manage roles" ON public.character_roles FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER trg_character_roles_updated BEFORE UPDATE ON public.character_roles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- characters
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  role_id UUID REFERENCES public.character_roles(id) ON DELETE SET NULL,
  image_url TEXT,
  sprite_right_url TEXT,
  sprite_left_url TEXT,
  sprite_jump_url TEXT,
  is_starter BOOLEAN NOT NULL DEFAULT true,
  is_free BOOLEAN NOT NULL DEFAULT true,
  credit_price INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.characters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view characters" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Owner manage characters" ON public.characters FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER trg_characters_updated BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- profile links
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.character_roles(id) ON DELETE SET NULL;
