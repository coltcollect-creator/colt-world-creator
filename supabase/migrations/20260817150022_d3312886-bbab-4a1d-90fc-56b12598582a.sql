CREATE TABLE public.player_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  image_url text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.player_notifications TO authenticated;
GRANT ALL ON public.player_notifications TO service_role;

ALTER TABLE public.player_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications read" ON public.player_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.player_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.player_notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX player_notifications_user_idx ON public.player_notifications (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.player_notifications;
ALTER TABLE public.player_notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.notify_player(
  _user_id uuid, _kind text, _title text, _body text DEFAULT NULL,
  _image_url text DEFAULT NULL, _link text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE nid uuid;
BEGIN
  INSERT INTO public.player_notifications (user_id, kind, title, body, image_url, link, metadata)
  VALUES (_user_id, _kind, _title, _body, _image_url, _link, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO nid;
  RETURN nid;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_player(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.place_auction_bid(_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  a public.auctions;
  next_bid int;
  cur int;
  new_bal int;
  prev_leader uuid;
  prev_amount int;
  bidder_name text;
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

    SELECT COALESCE(display_name, username) INTO bidder_name FROM public.profiles WHERE id = uid;
    PERFORM public.notify_player(
      prev_leader, 'auction_outbid',
      'עקפו אותך במכרז!',
      COALESCE(bidder_name, 'שחקן') || ' הציע 💎 ' || next_bid || ' על "' || a.name || '". היהלומים שלך (💎 ' || prev_amount || ') הוחזרו.',
      a.image_url, NULL,
      jsonb_build_object('auction_id', a.id, 'amount', next_bid, 'refunded', prev_amount)
    );
  END IF;

  INSERT INTO public.auction_bids (auction_id, user_id, amount) VALUES (_auction_id, uid, next_bid);
  UPDATE public.auctions
     SET current_bid = next_bid, current_leader = uid, status = 'live'
   WHERE id = _auction_id;

  RETURN jsonb_build_object('ok', true, 'bid', next_bid, 'new_balance', new_bal);
END;
$$;

REVOKE ALL ON FUNCTION public.place_auction_bid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_auction(_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.auctions;
  pid uuid;
  pname text;
  pimg text;
  names text := '';
  cnt int := 0;
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
      SELECT name, image_url INTO pname, pimg FROM public.products WHERE id = pid;
      IF pname IS NOT NULL THEN
        names := CASE WHEN names = '' THEN pname ELSE names || ', ' || pname END;
        cnt := cnt + 1;
      END IF;
    END LOOP;

    PERFORM public.notify_player(
      a.current_leader, 'auction_won',
      '🏆 זכית במכרז!',
      'זכית ב"' || a.name || '" עבור 💎 ' || COALESCE(a.current_bid, 0) ||
      CASE WHEN cnt > 0 THEN '. ' || names || ' נוסף למלאי שלך — אפשר לבקש משלוח או איסוף מהמלאי.' ELSE '.' END,
      COALESCE(a.image_url, pimg), '/inventory',
      jsonb_build_object('auction_id', a.id, 'amount', a.current_bid)
    );
  END IF;

  UPDATE public.auctions
     SET status = 'ended', winner_id = a.current_leader, settled_at = now()
   WHERE id = _auction_id;

  RETURN jsonb_build_object('ok', true, 'winner', a.current_leader, 'amount', a.current_bid);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_auction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_auction(uuid) TO authenticated;