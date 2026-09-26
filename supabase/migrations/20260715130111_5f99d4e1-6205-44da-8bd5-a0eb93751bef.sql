
-- =========================
-- ROLES & PROFILES
-- =========================
CREATE TYPE public.app_role AS ENUM ('player', 'owner');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  credits INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  active_title_id UUID,
  current_map_id UUID,
  last_x REAL NOT NULL DEFAULT 100,
  last_y REAL NOT NULL DEFAULT 100,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'owner'::public.app_role);
$$;

-- Policies for profiles
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT TO authenticated
  USING (true); -- public info: username, level, title, avatar_config
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND credits = (SELECT credits FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "profiles_owner_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "user_roles_owner_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- GAME SETTINGS
-- =========================
CREATE TABLE public.game_settings (
  id INT PRIMARY KEY DEFAULT 1,
  game_name TEXT NOT NULL DEFAULT 'COLT Market World',
  logo_url TEXT,
  favicon_url TEXT,
  default_map_id UUID,
  starting_credits INTEGER NOT NULL DEFAULT 100,
  starting_level INTEGER NOT NULL DEFAULT 1,
  starting_xp INTEGER NOT NULL DEFAULT 0,
  max_username_length INTEGER NOT NULL DEFAULT 20,
  quest_timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  movement_speed REAL NOT NULL DEFAULT 4.0,
  jump_strength REAL NOT NULL DEFAULT 12.0,
  gravity REAL NOT NULL DEFAULT 0.6,
  music_volume REAL NOT NULL DEFAULT 0.5,
  sound_volume REAL NOT NULL DEFAULT 0.7,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  registration_enabled BOOLEAN NOT NULL DEFAULT true,
  credit_purchasing_enabled BOOLEAN NOT NULL DEFAULT true,
  current_event TEXT,
  global_announcement TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
GRANT SELECT ON public.game_settings TO authenticated, anon;
GRANT ALL ON public.game_settings TO service_role;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.game_settings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "settings_owner_write" ON public.game_settings FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

INSERT INTO public.game_settings (id) VALUES (1);

-- =========================
-- ASSETS (upload library)
-- =========================
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- character_layer, npc_appearance, store_visual, decoration, background, sprite, sound, music, product_image
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  file_format TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_read" ON public.assets FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "assets_owner_write" ON public.assets FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- COSMETICS
-- =========================
CREATE TABLE public.cosmetic_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  layer_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.cosmetic_categories TO authenticated;
GRANT ALL ON public.cosmetic_categories TO service_role;
ALTER TABLE public.cosmetic_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_read" ON public.cosmetic_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_owner_write" ON public.cosmetic_categories FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.cosmetics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.cosmetic_categories(id) ON DELETE SET NULL,
  layer_type TEXT NOT NULL,
  image_url TEXT,
  thumbnail_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  layer_order INTEGER NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT true,
  credit_price INTEGER NOT NULL DEFAULT 0,
  required_level INTEGER NOT NULL DEFAULT 1,
  quest_requirement UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  limited_edition BOOLEAN NOT NULL DEFAULT false,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  compatibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_starter BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cosmetics TO authenticated;
GRANT ALL ON public.cosmetics TO service_role;
ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cosmetics_read" ON public.cosmetics FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "cosmetics_owner_write" ON public.cosmetics FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.player_cosmetics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id UUID NOT NULL REFERENCES public.cosmetics(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'purchase', -- purchase, starter, quest, grant, wheel, mystery_box
  UNIQUE(user_id, cosmetic_id)
);
GRANT SELECT ON public.player_cosmetics TO authenticated;
GRANT ALL ON public.player_cosmetics TO service_role;
ALTER TABLE public.player_cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_read_own" ON public.player_cosmetics FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "pc_owner_all" ON public.player_cosmetics FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- TITLES
-- =========================
CREATE TABLE public.titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  unlock_rule TEXT NOT NULL DEFAULT 'manual', -- level, quest, purchase, manual
  level_requirement INTEGER,
  quest_requirement UUID,
  credit_price INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.titles TO authenticated;
GRANT ALL ON public.titles TO service_role;
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "titles_read" ON public.titles FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "titles_owner_write" ON public.titles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.player_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, title_id)
);
GRANT SELECT ON public.player_titles TO authenticated;
GRANT ALL ON public.player_titles TO service_role;
ALTER TABLE public.player_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt_read_own" ON public.player_titles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "pt_owner" ON public.player_titles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- LEVELS / XP
-- =========================
CREATE TABLE public.levels (
  level INTEGER PRIMARY KEY,
  xp_required INTEGER NOT NULL,
  credit_reward INTEGER NOT NULL DEFAULT 0,
  cosmetic_reward UUID REFERENCES public.cosmetics(id),
  title_reward UUID REFERENCES public.titles(id),
  unlocks JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.levels TO authenticated;
GRANT ALL ON public.levels TO service_role;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levels_read" ON public.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "levels_owner_write" ON public.levels FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- MAPS
-- =========================
CREATE TABLE public.maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  width INTEGER NOT NULL DEFAULT 2000,
  height INTEGER NOT NULL DEFAULT 800,
  viewport_width INTEGER NOT NULL DEFAULT 1280,
  viewport_height INTEGER NOT NULL DEFAULT 720,
  background_url TEXT,
  parallax_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  music_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  published_version_id UUID,
  draft_version_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.maps TO authenticated;
GRANT ALL ON public.maps TO service_role;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maps_read_active" ON public.maps FOR SELECT TO authenticated
  USING ((is_active AND NOT is_archived) OR public.is_owner());
CREATE POLICY "maps_owner_write" ON public.maps FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.map_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published, archived
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(map_id, version_number)
);
GRANT SELECT ON public.map_versions TO authenticated;
GRANT ALL ON public.map_versions TO service_role;
ALTER TABLE public.map_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mv_read_published" ON public.map_versions FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_owner());
CREATE POLICY "mv_owner_write" ON public.map_versions FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.map_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_version_id UUID NOT NULL REFERENCES public.map_versions(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL, -- platform, wall, spawn, store, npc, decoration, portal, trigger, sign
  reference_id UUID, -- id of store_instance/npc_instance/asset
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  width REAL NOT NULL DEFAULT 100,
  height REAL NOT NULL DEFAULT 40,
  rotation REAL NOT NULL DEFAULT 0,
  scale REAL NOT NULL DEFAULT 1,
  layer INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  collision BOOLEAN NOT NULL DEFAULT true,
  interactive BOOLEAN NOT NULL DEFAULT false,
  locked BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.map_objects TO authenticated;
GRANT ALL ON public.map_objects TO service_role;
ALTER TABLE public.map_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mo_read" ON public.map_objects FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.map_versions v WHERE v.id = map_version_id AND (v.status = 'published' OR public.is_owner())));
CREATE POLICY "mo_owner_write" ON public.map_objects FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- STORES
-- =========================
CREATE TABLE public.store_visual_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  sprite_url TEXT,
  thumbnail_url TEXT,
  width INTEGER NOT NULL DEFAULT 200,
  height INTEGER NOT NULL DEFAULT 200,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_visual_templates TO authenticated;
GRANT ALL ON public.store_visual_templates TO service_role;
ALTER TABLE public.store_visual_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svt_read" ON public.store_visual_templates FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "svt_owner_write" ON public.store_visual_templates FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  store_type TEXT NOT NULL DEFAULT 'catalog', -- catalog, wheel, mystery_box, boutique, modal, interior
  visual_template_id UUID REFERENCES public.store_visual_templates(id),
  image_url TEXT,
  interaction_type TEXT NOT NULL DEFAULT 'modal',
  music_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_open BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_read" ON public.stores FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "stores_owner_write" ON public.stores FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  brand TEXT,
  image_url TEXT,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  product_type TEXT NOT NULL DEFAULT 'physical', -- physical, digital, cosmetic, decoration, title, mystery_box, coupon
  credit_price INTEGER NOT NULL DEFAULT 0,
  cash_price NUMERIC,
  stock INTEGER,
  unlimited_stock BOOLEAN NOT NULL DEFAULT false,
  purchase_limit INTEGER,
  required_level INTEGER NOT NULL DEFAULT 1,
  quest_requirement UUID,
  limited_edition BOOLEAN NOT NULL DEFAULT false,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  linked_cosmetic_id UUID REFERENCES public.cosmetics(id),
  linked_title_id UUID REFERENCES public.titles(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_read" ON public.products FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "products_owner_write" ON public.products FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- NPCs
-- =========================
CREATE TABLE public.npc_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sprite_url TEXT,
  thumbnail_url TEXT,
  width INTEGER NOT NULL DEFAULT 64,
  height INTEGER NOT NULL DEFAULT 96,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.npc_appearances TO authenticated;
GRANT ALL ON public.npc_appearances TO service_role;
ALTER TABLE public.npc_appearances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npca_read" ON public.npc_appearances FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "npca_owner" ON public.npc_appearances FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  appearance_id UUID REFERENCES public.npc_appearances(id),
  behavior TEXT NOT NULL DEFAULT 'idle', -- idle, patrol, wander
  walk_range REAL NOT NULL DEFAULT 200,
  movement_speed REAL NOT NULL DEFAULT 1.0,
  idle_duration_ms INTEGER NOT NULL DEFAULT 3000,
  interaction_enabled BOOLEAN NOT NULL DEFAULT true,
  random_speech_enabled BOOLEAN NOT NULL DEFAULT true,
  speech_interval_min_ms INTEGER NOT NULL DEFAULT 15000,
  speech_interval_max_ms INTEGER NOT NULL DEFAULT 45000,
  action_type TEXT NOT NULL DEFAULT 'speak', -- speak, open_store, open_quest, teleport, give_reward
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.npcs TO authenticated;
GRANT ALL ON public.npcs TO service_role;
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npcs_read" ON public.npcs FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "npcs_owner" ON public.npcs FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.npc_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  weight INTEGER NOT NULL DEFAULT 1,
  min_level INTEGER,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  interaction_only BOOLEAN NOT NULL DEFAULT false,
  auto_speech BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.npc_messages TO authenticated;
GRANT ALL ON public.npc_messages TO service_role;
ALTER TABLE public.npc_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npcm_read" ON public.npc_messages FOR SELECT TO authenticated USING (enabled OR public.is_owner());
CREATE POLICY "npcm_owner" ON public.npc_messages FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- QUESTS
-- =========================
CREATE TABLE public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  quest_type TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, one_time, tutorial, event, achievement, hidden
  action_type TEXT NOT NULL, -- login, visit_store, chat_public, chat_private, purchase, equip, spin_wheel, spend_credits, visit_npc
  target_amount INTEGER NOT NULL DEFAULT 1,
  credit_reward INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  cosmetic_reward UUID REFERENCES public.cosmetics(id),
  title_reward UUID REFERENCES public.titles(id),
  prerequisite_quest UUID REFERENCES public.quests(id),
  required_level INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  auto_claim BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quests TO authenticated;
GRANT ALL ON public.quests TO service_role;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quests_read" ON public.quests FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "quests_owner" ON public.quests FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.player_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  period_key TEXT, -- YYYY-MM-DD for daily, YYYY-Wxx for weekly
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_id, period_key)
);
GRANT SELECT ON public.player_quests TO authenticated;
GRANT ALL ON public.player_quests TO service_role;
ALTER TABLE public.player_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pq_read_own" ON public.player_quests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "pq_owner" ON public.player_quests FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- CREDITS: PACKAGES, ORDERS, LEDGER
-- =========================
CREATE TABLE public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credit_amount INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packages TO authenticated;
GRANT ALL ON public.credit_packages TO service_role;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_read" ON public.credit_packages FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "cp_owner" ON public.credit_packages FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL, -- credits_purchase, product_purchase, cosmetic_purchase
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, cancelled, refunded
  credit_package_id UUID REFERENCES public.credit_packages(id),
  product_id UUID REFERENCES public.products(id),
  cosmetic_id UUID REFERENCES public.cosmetics(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  cash_amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  shipping_info JSONB,
  payment_provider TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_read_own" ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "orders_owner" ON public.orders FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = credit, negative = debit
  transaction_type TEXT NOT NULL, -- purchase, grant, deduct, refund, quest, wheel, mystery_box, starter, level_reward
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  related_order UUID REFERENCES public.orders(id),
  related_quest UUID REFERENCES public.quests(id),
  related_cosmetic UUID REFERENCES public.cosmetics(id),
  related_product UUID REFERENCES public.products(id),
  admin_id UUID REFERENCES auth.users(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_read_own" ON public.credit_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "ct_owner" ON public.credit_transactions FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- MYSTERY BOXES & WHEEL
-- =========================
CREATE TABLE public.mystery_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  price_credits INTEGER NOT NULL DEFAULT 100,
  guaranteed_value INTEGER,
  stock INTEGER,
  unlimited_stock BOOLEAN NOT NULL DEFAULT true,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{cosmetic_id?, credits?, weight, rarity}]
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mystery_boxes TO authenticated;
GRANT ALL ON public.mystery_boxes TO service_role;
ALTER TABLE public.mystery_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mb_read" ON public.mystery_boxes FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "mb_owner" ON public.mystery_boxes FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.wheel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  spin_cost_credits INTEGER NOT NULL DEFAULT 50,
  daily_free_spins INTEGER NOT NULL DEFAULT 1,
  daily_spin_limit INTEGER NOT NULL DEFAULT 10,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wheel_configs TO authenticated;
GRANT ALL ON public.wheel_configs TO service_role;
ALTER TABLE public.wheel_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wc_read" ON public.wheel_configs FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "wc_owner" ON public.wheel_configs FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wheel_id UUID NOT NULL REFERENCES public.wheel_configs(id) ON DELETE CASCADE,
  reward JSONB NOT NULL,
  spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wheel_spins TO authenticated;
GRANT ALL ON public.wheel_spins TO service_role;
ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_read_own" ON public.wheel_spins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "ws_owner" ON public.wheel_spins FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =========================
-- CHAT
-- =========================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'global', -- global, map_<id>, dm_<uid>
  recipient_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_read" ON public.chat_messages FOR SELECT TO authenticated
  USING (
    (NOT deleted AND (channel = 'global' OR channel LIKE 'map_%' OR user_id = auth.uid() OR recipient_id = auth.uid()))
    OR public.is_owner()
  );
CREATE POLICY "chat_insert_own" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_muted OR p.is_suspended)));
CREATE POLICY "chat_owner" ON public.chat_messages FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.prohibited_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prohibited_words TO authenticated;
GRANT ALL ON public.prohibited_words TO service_role;
ALTER TABLE public.prohibited_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pw_read" ON public.prohibited_words FOR SELECT TO authenticated USING (true);
CREATE POLICY "pw_owner" ON public.prohibited_words FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, blocked_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bu_own" ON public.blocked_users FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================
-- AUDIT LOGS
-- =========================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_owner_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_owner());
CREATE POLICY "al_owner_write" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_owner());

-- =========================
-- ACTIVE PRESENCE (lightweight)
-- =========================
CREATE TABLE public.active_players (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  map_id UUID REFERENCES public.maps(id),
  x REAL NOT NULL DEFAULT 100,
  y REAL NOT NULL DEFAULT 100,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_players TO authenticated;
GRANT ALL ON public.active_players TO service_role;
ALTER TABLE public.active_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap_read" ON public.active_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "ap_upsert_own" ON public.active_players FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ap_update_own" ON public.active_players FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ap_delete_own" ON public.active_players FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =========================
-- Handle new user trigger: create profile
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  start_credits INTEGER;
  start_level INTEGER;
  start_xp INTEGER;
  chosen_username TEXT;
BEGIN
  SELECT starting_credits, starting_level, starting_xp INTO start_credits, start_level, start_xp FROM public.game_settings WHERE id = 1;
  chosen_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  -- ensure unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = chosen_username) LOOP
    chosen_username := chosen_username || substr(md5(random()::text), 1, 4);
  END LOOP;
  INSERT INTO public.profiles (id, username, credits, level, xp)
  VALUES (NEW.id, chosen_username, COALESCE(start_credits, 100), COALESCE(start_level, 1), COALESCE(start_xp, 0));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- update_updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER maps_updated BEFORE UPDATE ON public.maps FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- Secure credit purchase RPC
-- =========================
CREATE OR REPLACE FUNCTION public.purchase_cosmetic(_cosmetic_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_balance INTEGER;
  price INTEGER;
  cos public.cosmetics;
  new_balance INTEGER;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO cos FROM public.cosmetics WHERE id = _cosmetic_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'cosmetic not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_cosmetics WHERE user_id = uid AND cosmetic_id = _cosmetic_id) THEN
    RAISE EXCEPTION 'already owned';
  END IF;
  price := CASE WHEN cos.is_free THEN 0 ELSE cos.credit_price END;
  SELECT credits INTO cur_balance FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur_balance < price THEN RAISE EXCEPTION 'insufficient credits'; END IF;
  new_balance := cur_balance - price;
  UPDATE public.profiles SET credits = new_balance WHERE id = uid;
  INSERT INTO public.player_cosmetics (user_id, cosmetic_id, source) VALUES (uid, _cosmetic_id, 'purchase');
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, related_cosmetic, description)
  VALUES (uid, -price, 'purchase', cur_balance, new_balance, _cosmetic_id, 'Cosmetic purchase: ' || cos.name);
  RETURN jsonb_build_object('ok', true, 'new_balance', new_balance);
END; $$;

GRANT EXECUTE ON FUNCTION public.purchase_cosmetic(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_quest_reward(_quest_id UUID, _period_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pq public.player_quests;
  q public.quests;
  uid UUID := auth.uid();
  cur INTEGER;
  new_bal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO q FROM public.quests WHERE id = _quest_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'quest not found'; END IF;
  SELECT * INTO pq FROM public.player_quests WHERE user_id = uid AND quest_id = _quest_id AND (period_key = _period_key OR period_key IS NULL) FOR UPDATE;
  IF NOT FOUND OR pq.progress < q.target_amount THEN RAISE EXCEPTION 'not completed'; END IF;
  IF pq.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'already claimed'; END IF;
  SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  new_bal := cur + q.credit_reward;
  UPDATE public.profiles SET credits = new_bal, xp = xp + q.xp_reward WHERE id = uid;
  UPDATE public.player_quests SET claimed_at = now() WHERE id = pq.id;
  IF q.credit_reward > 0 THEN
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, related_quest, description)
    VALUES (uid, q.credit_reward, 'quest', cur, new_bal, _quest_id, 'Quest reward: ' || q.name);
  END IF;
  IF q.cosmetic_reward IS NOT NULL THEN
    INSERT INTO public.player_cosmetics (user_id, cosmetic_id, source) VALUES (uid, q.cosmetic_reward, 'quest')
    ON CONFLICT DO NOTHING;
  END IF;
  IF q.title_reward IS NOT NULL THEN
    INSERT INTO public.player_titles (user_id, title_id) VALUES (uid, q.title_reward) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'new_balance', new_bal);
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_quest_reward(UUID, TEXT) TO authenticated;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_players;
