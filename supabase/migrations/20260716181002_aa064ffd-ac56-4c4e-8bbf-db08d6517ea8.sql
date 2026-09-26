
ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.mystery_boxes
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text;

-- Spin the wheel: deducts spin cost, weighted random pick, applies reward, logs spin.
CREATE OR REPLACE FUNCTION public.spin_wheel(_wheel_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  w public.wheel_configs;
  rewards jsonb;
  total_w numeric := 0;
  r jsonb; pick jsonb;
  idx int := 0; chosen_idx int := -1;
  roll numeric; acc numeric := 0;
  cost int; cur int; new_bal int;
  rtype text; ramount int; rproduct uuid; rcosmetic uuid;
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
  ELSIF rtype = 'cosmetic' THEN
    rcosmetic := NULLIF(pick->>'cosmetic_id','')::uuid;
    IF rcosmetic IS NOT NULL THEN
      INSERT INTO public.player_cosmetics (user_id, cosmetic_id, source)
        VALUES (uid, rcosmetic, 'wheel') ON CONFLICT DO NOTHING;
    END IF;
  ELSIF rtype = 'product' THEN
    rproduct := NULLIF(pick->>'product_id','')::uuid;
    IF rproduct IS NOT NULL THEN
      INSERT INTO public.orders (user_id, order_type, status, product_id, quantity, credits_charged, fulfillment_status)
        VALUES (uid, 'wheel', 'completed', rproduct, 1, 0, 'awaiting_request');
    END IF;
  END IF;

  INSERT INTO public.wheel_spins (user_id, wheel_id, reward) VALUES (uid, _wheel_id, pick);
  RETURN jsonb_build_object('ok', true, 'reward', pick, 'index', chosen_idx, 'new_balance', new_bal);
END; $$;

GRANT EXECUTE ON FUNCTION public.spin_wheel(uuid) TO authenticated;

-- Open a mystery box: deducts price, weighted random pick, applies reward.
CREATE OR REPLACE FUNCTION public.open_mystery_box(_box_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  b public.mystery_boxes;
  rewards jsonb;
  total_w numeric := 0;
  r jsonb; pick jsonb;
  idx int := 0; chosen_idx int := -1;
  roll numeric; acc numeric := 0;
  price int; cur int; new_bal int;
  rtype text; ramount int; rproduct uuid; rcosmetic uuid;
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
    END IF;
  ELSIF rtype = 'product' THEN
    rproduct := NULLIF(pick->>'product_id','')::uuid;
    IF rproduct IS NOT NULL THEN
      INSERT INTO public.orders (user_id, order_type, status, product_id, quantity, credits_charged, fulfillment_status)
        VALUES (uid, 'mystery_box', 'completed', rproduct, 1, 0, 'awaiting_request');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'reward', pick, 'index', chosen_idx, 'new_balance', new_bal);
END; $$;

GRANT EXECUTE ON FUNCTION public.open_mystery_box(uuid) TO authenticated;

-- Buy and equip a cosmetic in one call (skins marketplace)
CREATE OR REPLACE FUNCTION public.buy_and_equip_cosmetic(_cosmetic_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  c public.cosmetics;
  cur int; new_bal int; price int;
  conf jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.cosmetics WHERE id = _cosmetic_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'cosmetic not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_cosmetics WHERE user_id = uid AND cosmetic_id = _cosmetic_id) THEN
    price := CASE WHEN c.is_free THEN 0 ELSE c.credit_price END;
    SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
    IF cur < price THEN RAISE EXCEPTION 'insufficient credits'; END IF;
    new_bal := cur - price;
    IF price > 0 THEN
      UPDATE public.profiles SET credits = new_bal WHERE id = uid;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, related_cosmetic, description)
      VALUES (uid, -price, 'purchase', cur, new_bal, _cosmetic_id, 'Cosmetic purchase: ' || c.name);
    ELSE
      new_bal := cur;
    END IF;
    INSERT INTO public.player_cosmetics (user_id, cosmetic_id, source) VALUES (uid, _cosmetic_id, 'purchase')
      ON CONFLICT DO NOTHING;
  ELSE
    SELECT credits INTO new_bal FROM public.profiles WHERE id = uid;
  END IF;
  SELECT COALESCE(avatar_config, '{}'::jsonb) INTO conf FROM public.profiles WHERE id = uid;
  conf := conf || jsonb_build_object(c.layer_type, _cosmetic_id::text);
  UPDATE public.profiles SET avatar_config = conf WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'new_balance', new_bal, 'avatar_config', conf);
END; $$;

GRANT EXECUTE ON FUNCTION public.buy_and_equip_cosmetic(uuid) TO authenticated;
