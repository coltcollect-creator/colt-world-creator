-- ============ treasure boxes ============
CREATE TABLE public.treasure_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  box_type text NOT NULL DEFAULT 'standard',
  reward jsonb NOT NULL DEFAULT '{}'::jsonb,
  require_mode text NOT NULL DEFAULT 'all',
  required_level integer,
  required_role_id uuid REFERENCES public.character_roles(id) ON DELETE SET NULL,
  required_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  require_all_clues boolean NOT NULL DEFAULT true,
  one_per_player boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasure_boxes TO authenticated;
GRANT ALL ON public.treasure_boxes TO service_role;
ALTER TABLE public.treasure_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage treasure boxes" ON public.treasure_boxes
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER treasure_boxes_updated_at BEFORE UPDATE ON public.treasure_boxes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ clues ============
CREATE TABLE public.clues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid REFERENCES public.treasure_boxes(id) ON DELETE CASCADE,
  name text NOT NULL,
  step_order integer NOT NULL DEFAULT 1,
  body text,
  image_url text,
  price_credits integer NOT NULL DEFAULT 0,
  available_in_wheel boolean NOT NULL DEFAULT false,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clues TO authenticated;
GRANT ALL ON public.clues TO service_role;
ALTER TABLE public.clues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage clues" ON public.clues
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER clues_updated_at BEFORE UPDATE ON public.clues
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ player progress ============
CREATE TABLE public.player_clues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clue_id uuid NOT NULL REFERENCES public.clues(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'purchase',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, clue_id)
);
GRANT SELECT ON public.player_clues TO authenticated;
GRANT ALL ON public.player_clues TO service_role;
ALTER TABLE public.player_clues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own clues" ON public.player_clues
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());

CREATE TABLE public.player_treasures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  box_id uuid NOT NULL REFERENCES public.treasure_boxes(id) ON DELETE CASCADE,
  reward jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, box_id)
);
GRANT SELECT ON public.player_treasures TO authenticated;
GRANT ALL ON public.player_treasures TO service_role;
ALTER TABLE public.player_treasures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own treasures" ON public.player_treasures
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());

-- ============ grant a clue (purchase / reward) ============
CREATE OR REPLACE FUNCTION public.grant_clue(_clue_id uuid, _source text DEFAULT 'purchase')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  c public.clues;
  price int; cur int; new_bal int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.clues WHERE id = _clue_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'clue not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_clues WHERE user_id = uid AND clue_id = _clue_id) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  price := CASE WHEN _source = 'purchase' THEN GREATEST(COALESCE(c.price_credits,0), 0) ELSE 0 END;
  SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur < price THEN RAISE EXCEPTION 'insufficient credits'; END IF;
  new_bal := cur - price;
  IF price > 0 THEN
    UPDATE public.profiles SET credits = new_bal WHERE id = uid;
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
    VALUES (uid, -price, 'clue', cur, new_bal, 'Clue purchase: ' || c.name);
  END IF;
  INSERT INTO public.player_clues (user_id, clue_id, source) VALUES (uid, _clue_id, COALESCE(_source,'purchase'))
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'new_balance', new_bal, 'clue', jsonb_build_object('id', c.id, 'name', c.name, 'body', c.body, 'image_url', c.image_url));
END; $$;
REVOKE ALL ON FUNCTION public.grant_clue(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_clue(uuid, text) TO authenticated;

-- ============ clue progress for the current player ============
CREATE OR REPLACE FUNCTION public.get_my_clue_progress()
RETURNS TABLE (
  box_id uuid, box_name text, box_type text, box_image text,
  clues_total int, clues_owned int, opened boolean,
  owned_clues jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.name, b.box_type, b.image_url,
         (SELECT count(*)::int FROM public.clues c WHERE c.box_id = b.id AND c.active),
         (SELECT count(*)::int FROM public.clues c JOIN public.player_clues pc ON pc.clue_id = c.id
            WHERE c.box_id = b.id AND c.active AND pc.user_id = auth.uid()),
         EXISTS (SELECT 1 FROM public.player_treasures pt WHERE pt.box_id = b.id AND pt.user_id = auth.uid()),
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'body', c.body,
                    'image_url', c.image_url, 'step_order', c.step_order) ORDER BY c.step_order)
                   FROM public.clues c JOIN public.player_clues pc ON pc.clue_id = c.id
                   WHERE c.box_id = b.id AND c.active AND pc.user_id = auth.uid()), '[]'::jsonb)
  FROM public.treasure_boxes b
  WHERE b.active AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.clues c WHERE c.box_id = b.id AND c.active)
  ORDER BY b.box_type, b.name;
$$;
REVOKE ALL ON FUNCTION public.get_my_clue_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_clue_progress() TO authenticated;

-- ============ box state for a player standing at a box ============
CREATE OR REPLACE FUNCTION public.get_treasure_box_state(_box_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  b public.treasure_boxes;
  p public.profiles;
  total int; owned int;
  ok_level boolean; ok_role boolean; ok_char boolean; ok_clues boolean;
  conds boolean[]; visible boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO b FROM public.treasure_boxes WHERE id = _box_id AND active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  SELECT * INTO p FROM public.profiles WHERE id = uid;
  SELECT count(*)::int INTO total FROM public.clues c WHERE c.box_id = b.id AND c.active;
  SELECT count(*)::int INTO owned FROM public.clues c JOIN public.player_clues pc ON pc.clue_id = c.id
    WHERE c.box_id = b.id AND c.active AND pc.user_id = uid;

  ok_level := b.required_level IS NULL OR COALESCE(p.level,1) >= b.required_level;
  ok_role  := b.required_role_id IS NULL OR p.role_id = b.required_role_id;
  ok_char  := b.required_character_id IS NULL OR p.character_id = b.required_character_id;
  ok_clues := NOT b.require_all_clues OR total = 0 OR owned >= total;

  conds := ARRAY[]::boolean[];
  IF b.required_level IS NOT NULL THEN conds := conds || ok_level; END IF;
  IF b.required_role_id IS NOT NULL THEN conds := conds || ok_role; END IF;
  IF b.required_character_id IS NOT NULL THEN conds := conds || ok_char; END IF;
  IF b.require_all_clues THEN conds := conds || ok_clues; END IF;

  IF array_length(conds, 1) IS NULL THEN visible := true;
  ELSIF b.require_mode = 'any' THEN visible := (SELECT bool_or(x) FROM unnest(conds) AS x);
  ELSE visible := (SELECT bool_and(x) FROM unnest(conds) AS x);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', b.id, 'name', b.name, 'description', b.description, 'image_url', b.image_url,
    'box_type', b.box_type,
    'clues_total', total, 'clues_owned', owned,
    'require_mode', b.require_mode, 'require_all_clues', b.require_all_clues,
    'required_level', b.required_level,
    'ok_level', ok_level, 'ok_role', ok_role, 'ok_character', ok_char, 'ok_clues', ok_clues,
    'visible', visible,
    'opened', EXISTS (SELECT 1 FROM public.player_treasures pt WHERE pt.box_id = b.id AND pt.user_id = uid),
    'one_per_player', b.one_per_player
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_treasure_box_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_treasure_box_state(uuid) TO authenticated;

-- ============ open a treasure box ============
CREATE OR REPLACE FUNCTION public.open_treasure_box(_box_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  state jsonb;
  b public.treasure_boxes;
  rw jsonb; rtype text; amt int; new_bal int;
  rprod uuid; rcos uuid; rclue uuid; rwheel uuid;
  prod record; cos record; clue record; spin_cost int;
  new_xp int; new_level int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  state := public.get_treasure_box_state(_box_id);
  IF NOT COALESCE((state->>'ok')::boolean, false) THEN RAISE EXCEPTION 'box not found'; END IF;
  IF NOT COALESCE((state->>'visible')::boolean, false) THEN RAISE EXCEPTION 'requirements not met'; END IF;
  SELECT * INTO b FROM public.treasure_boxes WHERE id = _box_id AND active FOR UPDATE;
  IF b.one_per_player AND EXISTS (SELECT 1 FROM public.player_treasures WHERE user_id = uid AND box_id = _box_id) THEN
    RAISE EXCEPTION 'already opened';
  END IF;

  rw := COALESCE(b.reward, '{}'::jsonb);
  rtype := rw->>'type';

  IF rtype = 'credits' THEN
    amt := GREATEST(COALESCE((rw->>'amount')::int, 0), 0);
    IF amt > 0 THEN
      UPDATE public.profiles SET credits = credits + amt WHERE id = uid RETURNING credits INTO new_bal;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
      VALUES (uid, amt, 'treasure', new_bal - amt, new_bal, 'Treasure box: ' || b.name);
    END IF;
  ELSIF rtype = 'xp' THEN
    amt := GREATEST(COALESCE((rw->>'amount')::int, 0), 0);
    UPDATE public.profiles SET xp = COALESCE(xp,0) + amt WHERE id = uid RETURNING xp INTO new_xp;
    SELECT COALESCE(max(l.level), 1) INTO new_level FROM public.levels l WHERE l.xp_required <= new_xp;
    UPDATE public.profiles SET level = GREATEST(COALESCE(level,1), new_level) WHERE id = uid;
    rw := rw || jsonb_build_object('new_xp', new_xp);
  ELSIF rtype = 'cosmetic' THEN
    rcos := NULLIF(rw->>'cosmetic_id','')::uuid;
    IF rcos IS NOT NULL THEN
      INSERT INTO public.player_cosmetics (user_id, cosmetic_id, source) VALUES (uid, rcos, 'treasure')
        ON CONFLICT DO NOTHING;
      SELECT name, thumbnail_url INTO cos FROM public.cosmetics WHERE id = rcos;
      rw := rw || jsonb_build_object('name', cos.name, 'image_url', cos.thumbnail_url);
    END IF;
  ELSIF rtype = 'product' THEN
    rprod := NULLIF(rw->>'product_id','')::uuid;
    IF rprod IS NOT NULL THEN
      UPDATE public.products SET stock = GREATEST(COALESCE(stock,0) - 1, 0) WHERE id = rprod AND NOT unlimited_stock;
      INSERT INTO public.orders (user_id, order_type, status, product_id, quantity, credits_charged, fulfillment_status)
      VALUES (uid, 'treasure', 'completed', rprod, 1, 0, 'awaiting_request');
      SELECT name, image_url, sku INTO prod FROM public.products WHERE id = rprod;
      rw := rw || jsonb_build_object('name', prod.name, 'image_url', prod.image_url, 'sku', prod.sku);
    END IF;
  ELSIF rtype = 'clue' THEN
    rclue := NULLIF(rw->>'clue_id','')::uuid;
    IF rclue IS NOT NULL THEN
      INSERT INTO public.player_clues (user_id, clue_id, source) VALUES (uid, rclue, 'treasure')
        ON CONFLICT DO NOTHING;
      SELECT name, body, image_url INTO clue FROM public.clues WHERE id = rclue;
      rw := rw || jsonb_build_object('name', clue.name, 'body', clue.body, 'image_url', clue.image_url);
    END IF;
  ELSIF rtype = 'wheel_spin' THEN
    rwheel := NULLIF(rw->>'wheel_id','')::uuid;
    SELECT COALESCE(spin_cost_credits, 0) INTO spin_cost FROM public.wheel_configs WHERE id = rwheel;
    spin_cost := COALESCE(spin_cost, 0);
    IF spin_cost > 0 THEN
      UPDATE public.profiles SET credits = credits + spin_cost WHERE id = uid RETURNING credits INTO new_bal;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
      VALUES (uid, spin_cost, 'treasure', new_bal - spin_cost, new_bal, 'Treasure box free spin: ' || b.name);
    END IF;
  END IF;

  INSERT INTO public.player_treasures (user_id, box_id, reward) VALUES (uid, _box_id, rw)
    ON CONFLICT (user_id, box_id) DO UPDATE SET reward = EXCLUDED.reward;

  SELECT credits INTO new_bal FROM public.profiles WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'reward', rw, 'new_balance', new_bal);
END; $$;
REVOKE ALL ON FUNCTION public.open_treasure_box(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_treasure_box(uuid) TO authenticated;

-- ============ wheel + mystery can award clues ============
CREATE OR REPLACE FUNCTION public.spin_wheel(_wheel_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $function$
DECLARE
  uid uuid := auth.uid();
  w public.wheel_configs;
  rewards jsonb;
  total_w numeric := 0;
  r jsonb; pick jsonb;
  idx int := 0; chosen_idx int := -1;
  roll numeric; acc numeric := 0;
  cost int; cur int; new_bal int;
  rtype text; ramount int; rproduct uuid; rcosmetic uuid; rclue uuid;
  prod record; cos record; clue record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO w FROM public.wheel_configs WHERE id = _wheel_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'wheel not found'; END IF;
  rewards := COALESCE(w.rewards, '[]'::jsonb);
  IF jsonb_array_length(rewards) = 0 THEN RAISE EXCEPTION 'no rewards configured'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(rewards) LOOP
    total_w := total_w + COALESCE((r->>'weight')::numeric, 0);
  END LOOP;
  IF total_w <= 0 THEN RAISE EXCEPTION 'invalid weights'; END IF;

  cost := COALESCE(w.spin_cost_credits, 0);
  SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur < cost THEN RAISE EXCEPTION 'insufficient credits'; END IF;
  new_bal := cur - cost;
  IF cost > 0 THEN
    UPDATE public.profiles SET credits = new_bal WHERE id = uid;
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
    VALUES (uid, -cost, 'wheel', cur, new_bal, 'Wheel spin: ' || w.name);
  END IF;

  roll := random() * total_w;
  FOR r IN SELECT * FROM jsonb_array_elements(rewards) LOOP
    acc := acc + COALESCE((r->>'weight')::numeric, 0);
    IF chosen_idx = -1 AND roll <= acc THEN
      pick := r; chosen_idx := idx;
    END IF;
    idx := idx + 1;
  END LOOP;
  IF pick IS NULL THEN pick := rewards->-1; chosen_idx := jsonb_array_length(rewards) - 1; END IF;

  rtype := pick->>'type';
  IF rtype = 'credits' THEN
    ramount := COALESCE((pick->>'amount')::int, 0);
    IF ramount > 0 THEN
      UPDATE public.profiles SET credits = credits + ramount WHERE id = uid RETURNING credits INTO new_bal;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
      VALUES (uid, ramount, 'wheel', new_bal - ramount, new_bal, 'Wheel prize: ' || COALESCE(pick->>'label', 'credits'));
    END IF;
  ELSIF rtype = 'free_spin' THEN
    IF cost > 0 THEN
      UPDATE public.profiles SET credits = credits + cost WHERE id = uid RETURNING credits INTO new_bal;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
      VALUES (uid, cost, 'wheel', new_bal - cost, new_bal, 'Wheel free spin refund: ' || w.name);
    END IF;
  ELSIF rtype = 'cosmetic' THEN
    rcosmetic := NULLIF(pick->>'cosmetic_id','')::uuid;
    IF rcosmetic IS NOT NULL THEN
      INSERT INTO public.player_cosmetics (user_id, cosmetic_id, source)
        VALUES (uid, rcosmetic, 'wheel') ON CONFLICT DO NOTHING;
      SELECT name, thumbnail_url INTO cos FROM public.cosmetics WHERE id = rcosmetic;
      pick := pick || jsonb_build_object('name', cos.name, 'image_url', cos.thumbnail_url);
    END IF;
  ELSIF rtype = 'clue' THEN
    rclue := NULLIF(pick->>'clue_id','')::uuid;
    IF rclue IS NOT NULL THEN
      INSERT INTO public.player_clues (user_id, clue_id, source)
        VALUES (uid, rclue, 'wheel') ON CONFLICT DO NOTHING;
      SELECT name, body, image_url INTO clue FROM public.clues WHERE id = rclue;
      pick := pick || jsonb_build_object('name', clue.name, 'body', clue.body, 'image_url', clue.image_url);
    END IF;
  ELSIF rtype = 'product' THEN
    rproduct := NULLIF(pick->>'product_id','')::uuid;
    IF rproduct IS NOT NULL THEN
      UPDATE public.products SET stock = GREATEST(COALESCE(stock, 0) - 1, 0)
        WHERE id = rproduct AND NOT unlimited_stock;
      INSERT INTO public.orders (user_id, order_type, status, product_id, quantity, credits_charged, fulfillment_status)
        VALUES (uid, 'wheel', 'completed', rproduct, 1, 0, 'awaiting_request');
      SELECT name, image_url, sku INTO prod FROM public.products WHERE id = rproduct;
      pick := pick || jsonb_build_object('name', prod.name, 'image_url', prod.image_url, 'sku', prod.sku);
    END IF;
  END IF;

  INSERT INTO public.wheel_spins (user_id, wheel_id, reward) VALUES (uid, _wheel_id, pick);
  RETURN jsonb_build_object('ok', true, 'reward', pick, 'index', chosen_idx, 'new_balance', new_bal);
END; $function$;

CREATE OR REPLACE FUNCTION public.open_mystery_box(_box_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $function$
DECLARE
  uid uuid := auth.uid();
  b public.mystery_boxes;
  rewards jsonb;
  total_w numeric := 0;
  r jsonb; pick jsonb;
  idx int := 0; chosen_idx int := -1;
  roll numeric; acc numeric := 0;
  price int; cur int; new_bal int;
  rtype text; ramount int; rproduct uuid; rcosmetic uuid; rclue uuid;
  prod record; cos record; clue record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO b FROM public.mystery_boxes WHERE id = _box_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'box not found'; END IF;
  IF NOT b.unlimited_stock AND COALESCE(b.stock, 0) <= 0 THEN RAISE EXCEPTION 'out of stock'; END IF;
  rewards := COALESCE(b.rewards, '[]'::jsonb);
  IF jsonb_array_length(rewards) = 0 THEN RAISE EXCEPTION 'no rewards configured'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(rewards) LOOP
    total_w := total_w + COALESCE((r->>'weight')::numeric, 0);
  END LOOP;
  IF total_w <= 0 THEN RAISE EXCEPTION 'invalid weights'; END IF;

  price := COALESCE(b.price_credits, 0);
  SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur < price THEN RAISE EXCEPTION 'insufficient credits'; END IF;
  new_bal := cur - price;
  IF price > 0 THEN
    UPDATE public.profiles SET credits = new_bal WHERE id = uid;
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
    VALUES (uid, -price, 'mystery_box', cur, new_bal, 'Mystery box: ' || b.name);
  END IF;
  IF NOT b.unlimited_stock THEN
    UPDATE public.mystery_boxes SET stock = stock - 1 WHERE id = _box_id;
  END IF;

  roll := random() * total_w;
  FOR r IN SELECT * FROM jsonb_array_elements(rewards) LOOP
    acc := acc + COALESCE((r->>'weight')::numeric, 0);
    IF chosen_idx = -1 AND roll <= acc THEN pick := r; chosen_idx := idx; END IF;
    idx := idx + 1;
  END LOOP;
  IF pick IS NULL THEN pick := rewards->-1; chosen_idx := jsonb_array_length(rewards) - 1; END IF;

  rtype := pick->>'type';
  IF rtype = 'credits' THEN
    ramount := COALESCE((pick->>'amount')::int, 0);
    IF ramount > 0 THEN
      UPDATE public.profiles SET credits = credits + ramount WHERE id = uid RETURNING credits INTO new_bal;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
      VALUES (uid, ramount, 'mystery_box', new_bal - ramount, new_bal, 'Mystery box prize: ' || COALESCE(pick->>'label', 'credits'));
    END IF;
  ELSIF rtype = 'cosmetic' THEN
    rcosmetic := NULLIF(pick->>'cosmetic_id','')::uuid;
    IF rcosmetic IS NOT NULL THEN
      INSERT INTO public.player_cosmetics (user_id, cosmetic_id, source)
        VALUES (uid, rcosmetic, 'mystery_box') ON CONFLICT DO NOTHING;
      SELECT name, thumbnail_url INTO cos FROM public.cosmetics WHERE id = rcosmetic;
      pick := pick || jsonb_build_object('name', cos.name, 'image_url', cos.thumbnail_url);
    END IF;
  ELSIF rtype = 'clue' THEN
    rclue := NULLIF(pick->>'clue_id','')::uuid;
    IF rclue IS NOT NULL THEN
      INSERT INTO public.player_clues (user_id, clue_id, source)
        VALUES (uid, rclue, 'mystery_box') ON CONFLICT DO NOTHING;
      SELECT name, body, image_url INTO clue FROM public.clues WHERE id = rclue;
      pick := pick || jsonb_build_object('name', clue.name, 'body', clue.body, 'image_url', clue.image_url);
    END IF;
  ELSIF rtype = 'product' THEN
    rproduct := NULLIF(pick->>'product_id','')::uuid;
    IF rproduct IS NOT NULL THEN
      UPDATE public.products SET stock = GREATEST(COALESCE(stock, 0) - 1, 0)
        WHERE id = rproduct AND NOT unlimited_stock;
      INSERT INTO public.orders (user_id, order_type, status, product_id, quantity, credits_charged, fulfillment_status)
        VALUES (uid, 'mystery_box', 'completed', rproduct, 1, 0, 'awaiting_request');
      SELECT name, image_url, sku INTO prod FROM public.products WHERE id = rproduct;
      pick := pick || jsonb_build_object('name', prod.name, 'image_url', prod.image_url, 'sku', prod.sku);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'reward', pick, 'index', chosen_idx, 'new_balance', new_bal);
END; $function$;

-- clues offered in a specific store (visible catalog entries)
CREATE OR REPLACE FUNCTION public.get_store_clues(_store_id uuid)
RETURNS TABLE (id uuid, name text, image_url text, price_credits int, box_name text, owned boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.image_url, c.price_credits, b.name,
         EXISTS (SELECT 1 FROM public.player_clues pc WHERE pc.clue_id = c.id AND pc.user_id = auth.uid())
  FROM public.clues c
  LEFT JOIN public.treasure_boxes b ON b.id = c.box_id
  WHERE c.active AND c.store_id = _store_id AND auth.uid() IS NOT NULL
  ORDER BY c.step_order, c.name;
$$;
REVOKE ALL ON FUNCTION public.get_store_clues(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_clues(uuid) TO authenticated;