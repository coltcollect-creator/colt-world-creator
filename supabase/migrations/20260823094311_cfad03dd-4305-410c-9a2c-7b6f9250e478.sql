CREATE TABLE public.live_rips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  total_slots integer NOT NULL DEFAULT 10,
  price_credits integer NOT NULL DEFAULT 100,
  max_slots_per_user integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'scheduled',
  youtube_url text,
  closed_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_rips TO authenticated;
GRANT ALL ON public.live_rips TO service_role;
ALTER TABLE public.live_rips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_rips_read_auth" ON public.live_rips FOR SELECT TO authenticated USING (active OR public.is_owner());
CREATE POLICY "live_rips_owner_all" ON public.live_rips FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER live_rips_updated BEFORE UPDATE ON public.live_rips FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.live_rip_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rip_id uuid NOT NULL REFERENCES public.live_rips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_number integer NOT NULL,
  credits_paid integer NOT NULL DEFAULT 0,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rip_id, slot_number)
);

GRANT SELECT ON public.live_rip_slots TO authenticated;
GRANT ALL ON public.live_rip_slots TO service_role;
ALTER TABLE public.live_rip_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_rip_slots_read" ON public.live_rip_slots FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());
CREATE POLICY "live_rip_slots_owner_write" ON public.live_rip_slots FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE OR REPLACE FUNCTION public.join_live_rip(_rip_id uuid, _count integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  r public.live_rips;
  taken int; mine int; want int; total_cost int;
  cur int; new_bal int; i int; nxt int; oid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO r FROM public.live_rips WHERE id = _rip_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'live rip not found'; END IF;
  IF r.status = 'closed' OR r.closed_at IS NOT NULL THEN RAISE EXCEPTION 'live rip closed'; END IF;

  want := GREATEST(COALESCE(_count, 1), 1);
  SELECT count(*)::int INTO taken FROM public.live_rip_slots WHERE rip_id = _rip_id;
  SELECT count(*)::int INTO mine FROM public.live_rip_slots WHERE rip_id = _rip_id AND user_id = uid;

  IF taken + want > r.total_slots THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sold_out', 'remaining', r.total_slots - taken);
  END IF;
  IF mine + want > r.max_slots_per_user THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached', 'allowed', r.max_slots_per_user - mine);
  END IF;

  total_cost := r.price_credits * want;
  SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur < total_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'needed', total_cost, 'balance', cur);
  END IF;
  new_bal := cur - total_cost;
  UPDATE public.profiles SET credits = new_bal WHERE id = uid;
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, related_product, description)
  VALUES (uid, -total_cost, 'live_rip', cur, new_bal, r.product_id, 'Live rip entry: ' || r.name);

  FOR i IN 1..want LOOP
    SELECT COALESCE(max(slot_number), 0) + 1 INTO nxt FROM public.live_rip_slots WHERE rip_id = _rip_id;
    oid := NULL;
    IF r.product_id IS NOT NULL THEN
      UPDATE public.products SET stock = GREATEST(COALESCE(stock, 0) - 1, 0)
        WHERE id = r.product_id AND NOT unlimited_stock;
      INSERT INTO public.orders (user_id, order_type, status, product_id, store_id, quantity, credits_charged, fulfillment_status)
      VALUES (uid, 'live_rip', 'completed', r.product_id, r.store_id, 1, r.price_credits, 'awaiting_request')
      RETURNING id INTO oid;
    END IF;
    INSERT INTO public.live_rip_slots (rip_id, user_id, slot_number, credits_paid, order_id)
    VALUES (_rip_id, uid, nxt, r.price_credits, oid);
  END LOOP;

  SELECT count(*)::int INTO taken FROM public.live_rip_slots WHERE rip_id = _rip_id;
  IF taken >= r.total_slots THEN
    UPDATE public.live_rips SET status = 'full' WHERE id = _rip_id;
  ELSE
    UPDATE public.live_rips SET status = 'open' WHERE id = _rip_id AND status = 'scheduled';
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_balance', new_bal, 'slots_taken', taken, 'bought', want);
END; $function$;

REVOKE ALL ON FUNCTION public.join_live_rip(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_live_rip(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_live_rip(_rip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.live_rips;
  s record;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO r FROM public.live_rips WHERE id = _rip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'live rip not found'; END IF;
  IF r.closed_at IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  UPDATE public.live_rips SET status = 'closed', closed_at = now() WHERE id = _rip_id;

  FOR s IN SELECT DISTINCT user_id FROM public.live_rip_slots WHERE rip_id = _rip_id LOOP
    PERFORM public.notify_player(
      s.user_id, 'live_rip_closed',
      '📦 ה-Live Rip נסגר!',
      'ההשתתפות שלך ב"' || r.name || '" נסגרה. החבילה נוספה למלאי שלך — אפשר לבחור משלוח או איסוף.',
      r.image_url, '/inventory',
      jsonb_build_object('live_rip_id', r.id)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END; $function$;

REVOKE ALL ON FUNCTION public.close_live_rip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_live_rip(uuid) TO authenticated;