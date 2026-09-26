
-- Extend credit_packages
ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS meshulam_page_url TEXT,
  ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '💎',
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_token_uidx
  ON public.orders (payment_token) WHERE payment_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_payment_reference_idx
  ON public.orders (payment_reference) WHERE payment_reference IS NOT NULL;

-- Public read of active packages (anon + authenticated)
DROP POLICY IF EXISTS "Public read active credit packages" ON public.credit_packages;
CREATE POLICY "Public read active credit packages"
  ON public.credit_packages FOR SELECT
  TO anon, authenticated
  USING (active = true);

GRANT SELECT ON public.credit_packages TO anon;

-- RPC: credit a gem pack purchase after verified webhook (service_role only)
CREATE OR REPLACE FUNCTION public.credit_gem_pack(_order_id uuid, _reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  pkg public.credit_packages;
  gems_to_add INT;
  cur INT;
  new_bal INT;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.order_type <> 'gem_pack' THEN RAISE EXCEPTION 'invalid order type'; END IF;
  IF o.payment_status = 'paid' THEN
    -- Idempotent: already credited
    SELECT credits INTO new_bal FROM public.profiles WHERE id = o.user_id;
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'new_balance', new_bal);
  END IF;

  SELECT * INTO pkg FROM public.credit_packages WHERE id = o.credit_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'package not found'; END IF;
  gems_to_add := pkg.credit_amount + COALESCE(pkg.bonus_credits, 0);

  SELECT credits INTO cur FROM public.profiles WHERE id = o.user_id FOR UPDATE;
  new_bal := cur + gems_to_add;
  UPDATE public.profiles SET credits = new_bal WHERE id = o.user_id;

  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, balance_before, balance_after, related_order, description)
  VALUES
    (o.user_id, gems_to_add, 'gem_pack', cur, new_bal, o.id,
     'Gem pack purchase: ' || pkg.name);

  UPDATE public.orders
     SET payment_status = 'paid',
         status = 'completed',
         payment_reference = COALESCE(_reference, payment_reference),
         updated_at = now()
   WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true, 'new_balance', new_bal, 'gems_added', gems_to_add);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_gem_pack(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_gem_pack(uuid, text) TO service_role;
