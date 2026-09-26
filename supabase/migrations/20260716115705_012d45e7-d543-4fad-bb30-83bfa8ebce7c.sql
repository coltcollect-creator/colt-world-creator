
-- Cosmetics: link to a store
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Orders: fulfillment
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'awaiting_request',
  ADD COLUMN IF NOT EXISTS shipping_method TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_gems_paid INTEGER NOT NULL DEFAULT 0;

-- Game settings: shipping globals
ALTER TABLE public.game_settings
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_gems_cost INTEGER NOT NULL DEFAULT 0;

-- Purchase product function
CREATE OR REPLACE FUNCTION public.purchase_product(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  p public.products;
  cur INT;
  new_bal INT;
  price INT;
  order_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  IF NOT p.unlimited_stock AND COALESCE(p.stock, 0) <= 0 THEN
    RAISE EXCEPTION 'out of stock';
  END IF;
  price := p.credit_price;
  SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur < price THEN RAISE EXCEPTION 'insufficient credits'; END IF;
  new_bal := cur - price;
  UPDATE public.profiles SET credits = new_bal WHERE id = uid;
  IF NOT p.unlimited_stock THEN
    UPDATE public.products SET stock = stock - 1 WHERE id = _product_id;
  END IF;
  INSERT INTO public.orders (user_id, order_type, status, product_id, store_id, quantity, credits_charged, fulfillment_status)
  VALUES (uid, 'product', 'completed', _product_id, p.store_id, 1, price, 'awaiting_request')
  RETURNING id INTO order_id;
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, related_product, related_order, description)
  VALUES (uid, -price, 'purchase', cur, new_bal, _product_id, order_id, 'Product purchase: ' || p.name);
  -- quest progress
  PERFORM public.progress_quest('purchase', 1);
  RETURN jsonb_build_object('ok', true, 'new_balance', new_bal, 'order_id', order_id);
END; $$;

-- Request delivery
CREATE OR REPLACE FUNCTION public.request_delivery(_order_id UUID, _method TEXT, _address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  o public.orders;
  ship_cost INT := 0;
  cur INT;
  new_bal INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.user_id <> uid THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.fulfillment_status <> 'awaiting_request' THEN RAISE EXCEPTION 'already requested'; END IF;
  IF _method NOT IN ('pickup', 'shipping') THEN RAISE EXCEPTION 'invalid method'; END IF;
  IF _method = 'shipping' THEN
    SELECT COALESCE(shipping_gems_cost, 0) INTO ship_cost FROM public.game_settings WHERE id = 1;
    IF ship_cost > 0 THEN
      SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
      IF cur < ship_cost THEN RAISE EXCEPTION 'insufficient credits for shipping'; END IF;
      new_bal := cur - ship_cost;
      UPDATE public.profiles SET credits = new_bal WHERE id = uid;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, related_order, description)
      VALUES (uid, -ship_cost, 'purchase', cur, new_bal, _order_id, 'Shipping fee');
    END IF;
  END IF;
  UPDATE public.orders
     SET fulfillment_status = 'in_transit',
         shipping_method = _method,
         delivery_address = _address,
         shipping_gems_paid = ship_cost
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Mark delivered (owner)
CREATE OR REPLACE FUNCTION public.mark_order_delivered(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.orders SET fulfillment_status = 'delivered', delivered_at = now() WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.purchase_product(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_delivery(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_delivered(UUID) TO authenticated;
