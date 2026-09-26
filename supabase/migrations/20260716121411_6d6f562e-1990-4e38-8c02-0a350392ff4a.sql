
CREATE OR REPLACE FUNCTION public.request_bulk_delivery(_order_ids uuid[], _method text, _address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  ship_cost INT := 0;
  cur INT;
  new_bal INT;
  cnt INT := 0;
  oid UUID;
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

  FOREACH oid IN ARRAY _order_ids LOOP
    UPDATE public.orders
       SET fulfillment_status = 'in_transit',
           shipping_method = _method,
           delivery_address = _address,
           shipping_gems_paid = CASE WHEN cnt = 0 THEN ship_cost ELSE 0 END
     WHERE id = oid
       AND user_id = uid
       AND fulfillment_status = 'awaiting_request';
    IF FOUND THEN cnt := cnt + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', cnt, 'shipping_charged', ship_cost);
END; $$;

GRANT EXECUTE ON FUNCTION public.request_bulk_delivery(uuid[], text, text) TO authenticated;
