CREATE OR REPLACE FUNCTION public.remove_product_from_wheels(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wrow record;
  kept jsonb;
  total numeric;
  rebalanced jsonb;
  el jsonb;
BEGIN
  FOR wrow IN SELECT id, rewards FROM public.wheel_configs WHERE rewards @> jsonb_build_array(jsonb_build_object('product_id', _product_id::text)) LOOP
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO kept
    FROM jsonb_array_elements(COALESCE(wrow.rewards, '[]'::jsonb)) e
    WHERE NOT (e->>'type' = 'product' AND e->>'product_id' = _product_id::text);

    total := 0;
    FOR el IN SELECT * FROM jsonb_array_elements(kept) LOOP
      total := total + COALESCE((el->>'weight')::numeric, 0);
    END LOOP;

    rebalanced := '[]'::jsonb;
    FOR el IN SELECT * FROM jsonb_array_elements(kept) LOOP
      rebalanced := rebalanced || jsonb_build_array(
        el || jsonb_build_object('weight',
          CASE WHEN total > 0 THEN round((COALESCE((el->>'weight')::numeric, 0) / total) * 100, 2)
               ELSE round(100.0 / GREATEST(jsonb_array_length(kept), 1), 2) END)
      );
    END LOOP;

    UPDATE public.wheel_configs SET rewards = rebalanced WHERE id = wrow.id;
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.remove_product_from_wheels(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.spin_wheel(_wheel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    NULL;
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
        VALUES (uid, 'wheel', 'completed', rproduct, 1, cost, 'awaiting_request');
      SELECT name, image_url, sku, stock, unlimited_stock, active INTO prod FROM public.products WHERE id = rproduct;
      pick := pick || jsonb_build_object('name', prod.name, 'image_url', prod.image_url, 'sku', prod.sku);
      -- once out of stock (or deactivated), drop the prize from every wheel
      IF NOT prod.unlimited_stock AND (COALESCE(prod.stock, 0) <= 0 OR NOT prod.active) THEN
        PERFORM public.remove_product_from_wheels(rproduct);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.wheel_spins (user_id, wheel_id, reward) VALUES (uid, _wheel_id, pick);
  RETURN jsonb_build_object('ok', true, 'reward', pick, 'index', chosen_idx, 'new_balance', new_bal);
END; $function$;