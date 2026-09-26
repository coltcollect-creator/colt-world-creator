CREATE TABLE public.auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  starting_price integer NOT NULL DEFAULT 100,
  bid_increment integer NOT NULL DEFAULT 10,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  current_bid integer,
  current_leader uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  settled_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auctions TO anon;
GRANT SELECT ON public.auctions TO authenticated;
GRANT ALL ON public.auctions TO service_role;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auctions_public_read" ON public.auctions FOR SELECT USING (true);
CREATE POLICY "auctions_owner_all" ON public.auctions FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER auctions_updated BEFORE UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.auction_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  refunded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auction_bids_auction_idx ON public.auction_bids(auction_id, created_at DESC);

GRANT SELECT ON public.auction_bids TO authenticated;
GRANT SELECT ON public.auction_bids TO anon;
GRANT ALL ON public.auction_bids TO service_role;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auction_bids_public_read" ON public.auction_bids FOR SELECT USING (true);
CREATE POLICY "auction_bids_owner_all" ON public.auction_bids FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;

CREATE OR REPLACE FUNCTION public.place_auction_bid(_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  a public.auctions;
  next_bid int;
  cur int;
  new_bal int;
  prev_leader uuid;
  prev_amount int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = _auction_id FOR UPDATE;
  IF NOT FOUND OR NOT a.active THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF a.status = 'ended' OR a.settled_at IS NOT NULL THEN RAISE EXCEPTION 'auction ended'; END IF;
  IF a.starts_at > now() THEN RAISE EXCEPTION 'auction not started'; END IF;
  IF a.ends_at IS NOT NULL AND a.ends_at < now() THEN RAISE EXCEPTION 'auction ended'; END IF;
  IF a.current_leader = uid THEN RAISE EXCEPTION 'already leading'; END IF;

  next_bid := CASE WHEN a.current_bid IS NULL THEN a.starting_price ELSE a.current_bid + a.bid_increment END;

  SELECT credits INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur < next_bid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'needed', next_bid, 'balance', cur);
  END IF;
  new_bal := cur - next_bid;
  UPDATE public.profiles SET credits = new_bal WHERE id = uid;
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
  VALUES (uid, -next_bid, 'auction', cur, new_bal, 'Auction bid: ' || a.name);

  prev_leader := a.current_leader;
  prev_amount := a.current_bid;
  IF prev_leader IS NOT NULL AND prev_amount IS NOT NULL THEN
    SELECT credits INTO cur FROM public.profiles WHERE id = prev_leader FOR UPDATE;
    UPDATE public.profiles SET credits = cur + prev_amount WHERE id = prev_leader;
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
    VALUES (prev_leader, prev_amount, 'auction_refund', cur, cur + prev_amount, 'Auction outbid refund: ' || a.name);
    UPDATE public.auction_bids SET refunded = true
      WHERE auction_id = _auction_id AND user_id = prev_leader AND amount = prev_amount AND NOT refunded;
  END IF;

  INSERT INTO public.auction_bids (auction_id, user_id, amount) VALUES (_auction_id, uid, next_bid);
  UPDATE public.auctions
     SET current_bid = next_bid, current_leader = uid, status = 'live'
   WHERE id = _auction_id;

  RETURN jsonb_build_object('ok', true, 'bid', next_bid, 'new_balance', new_bal);
END; $$;

REVOKE ALL ON FUNCTION public.place_auction_bid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_auction(_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.auctions;
  pid uuid;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = _auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF a.settled_at IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  IF a.current_leader IS NOT NULL THEN
    FOREACH pid IN ARRAY COALESCE(a.product_ids, '{}'::uuid[]) LOOP
      UPDATE public.products SET stock = GREATEST(COALESCE(stock,0) - 1, 0)
        WHERE id = pid AND NOT unlimited_stock;
      INSERT INTO public.orders (user_id, order_type, status, product_id, store_id, quantity, credits_charged, fulfillment_status)
      VALUES (a.current_leader, 'auction', 'completed', pid, a.store_id, 1, COALESCE(a.current_bid, 0), 'awaiting_request');
    END LOOP;
  END IF;

  UPDATE public.auctions
     SET status = 'ended', winner_id = a.current_leader, settled_at = now()
   WHERE id = _auction_id;

  RETURN jsonb_build_object('ok', true, 'winner', a.current_leader, 'amount', a.current_bid);
END; $$;

REVOKE ALL ON FUNCTION public.settle_auction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_auction(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_auction(_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.auctions;
  cur int;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = _auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF a.current_leader IS NOT NULL AND a.current_bid IS NOT NULL AND a.settled_at IS NULL THEN
    SELECT credits INTO cur FROM public.profiles WHERE id = a.current_leader FOR UPDATE;
    UPDATE public.profiles SET credits = cur + a.current_bid WHERE id = a.current_leader;
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, balance_before, balance_after, description)
    VALUES (a.current_leader, a.current_bid, 'auction_refund', cur, cur + a.current_bid, 'Auction cancelled refund: ' || a.name);
    UPDATE public.auction_bids SET refunded = true WHERE auction_id = _auction_id AND NOT refunded;
  END IF;
  UPDATE public.auctions SET status = 'ended', active = false, settled_at = now(), current_bid = NULL, current_leader = NULL WHERE id = _auction_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.cancel_auction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_auction(uuid) TO authenticated;