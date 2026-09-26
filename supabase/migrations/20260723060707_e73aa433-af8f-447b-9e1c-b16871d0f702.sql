
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
  prod record; cos record;
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
    -- Refund the spin cost so the free spin doesn't consume credits.
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
  ELSIF rtype = 'product' THEN
    rproduct := NULLIF(pick->>'product_id','')::uuid;
    IF rproduct IS NOT NULL THEN
      INSERT INTO public.orders (user_id, order_type, status, product_id, quantity, credits_charged, fulfillment_status)
        VALUES (uid, 'wheel', 'completed', rproduct, 1, 0, 'awaiting_request');
      SELECT name, image_url, sku INTO prod FROM public.products WHERE id = rproduct;
      pick := pick || jsonb_build_object('name', prod.name, 'image_url', prod.image_url, 'sku', prod.sku);
    END IF;
  END IF;

  INSERT INTO public.wheel_spins (user_id, wheel_id, reward) VALUES (uid, _wheel_id, pick);
  RETURN jsonb_build_object('ok', true, 'reward', pick, 'index', chosen_idx, 'new_balance', new_bal);
END; $$;
