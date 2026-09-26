
-- Product SKU
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;

-- Order numbers (per-order human friendly)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1001;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number BIGINT;
UPDATE public.orders SET order_number = nextval('public.order_number_seq') WHERE order_number IS NULL;
ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT nextval('public.order_number_seq');
ALTER TABLE public.orders ALTER COLUMN order_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_idx ON public.orders(order_number);

-- Shipment numbers group bulk delivery requests together
CREATE SEQUENCE IF NOT EXISTS public.shipment_number_seq START 5001;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipment_number BIGINT;
CREATE INDEX IF NOT EXISTS orders_shipment_number_idx ON public.orders(shipment_number);

-- Update single-order delivery to also stamp a shipment number
CREATE OR REPLACE FUNCTION public.request_delivery(_order_id uuid, _method text, _address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  o public.orders;
  ship_cost INT := 0;
  cur INT;
  new_bal INT;
  ship_no BIGINT;
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
  ship_no := nextval('public.shipment_number_seq');
  UPDATE public.orders
     SET fulfillment_status = 'in_transit',
         shipping_method = _method,
         delivery_address = _address,
         shipping_gems_paid = ship_cost,
         shipment_number = ship_no
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true, 'shipment_number', ship_no);
END; $function$;

-- Update bulk delivery to assign a single shipment number for the whole request
CREATE OR REPLACE FUNCTION public.request_bulk_delivery(_order_ids uuid[], _method text, _address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  ship_cost INT := 0;
  cur INT;
  new_bal INT;
  cnt INT := 0;
  oid UUID;
  ship_no BIGINT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _method NOT IN ('pickup','shipping') THEN RAISE EXCEPTION 'invalid method'; END IF;
  IF array_length(_order_ids, 1) IS NULL THEN RAISE EXCEPTION 'no orders'; END IF;

  IF _method = 'shipping' THEN
    SELECT COALESCE(shipping_gems_cost, 0) INTO ship_cost FROM public.game_settings WHERE id = 1;
    IF ship_cost > 0 THEN
      SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
      IF cur < ship_cost THEN RAISE EXCEPTION 'insufficient credits for shipping'; END IF;
      new_bal := cur - ship_cost;
      UPDATE public.profiles SET credits = new_bal WHERE id = uid;
      INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
      VALUES (uid, -ship_cost, 'purchase', cur, new_bal, 'Bulk shipping fee');
    END IF;
  END IF;

  ship_no := nextval('public.shipment_number_seq');

  FOREACH oid IN ARRAY _order_ids LOOP
    UPDATE public.orders
       SET fulfillment_status = 'in_transit',
           shipping_method = _method,
           delivery_address = _address,
           shipping_gems_paid = CASE WHEN cnt = 0 THEN ship_cost ELSE 0 END,
           shipment_number = ship_no
     WHERE id = oid
       AND user_id = uid
       AND fulfillment_status = 'awaiting_request';
    IF FOUND THEN cnt := cnt + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', cnt, 'shipping_charged', ship_cost, 'shipment_number', ship_no);
END; $function$;
