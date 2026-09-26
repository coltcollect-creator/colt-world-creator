-- 1) auction_bids: restrict SELECT to own bids or owner
DROP POLICY IF EXISTS "auction_bids_read_authenticated" ON public.auction_bids;

CREATE POLICY "auction_bids_select_own_or_owner"
ON public.auction_bids
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_owner());

-- Safe public bid feed (no user ids exposed)
CREATE OR REPLACE FUNCTION public.get_auction_bid_feed(_auction_id uuid, _limit integer DEFAULT 10)
RETURNS TABLE(id uuid, amount integer, created_at timestamptz, bidder_name text, is_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id,
         b.amount,
         b.created_at,
         COALESCE(p.display_name, p.username, 'שחקן') AS bidder_name,
         (b.user_id = auth.uid()) AS is_me
  FROM public.auction_bids b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.auction_id = _auction_id
    AND auth.uid() IS NOT NULL
  ORDER BY b.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 10), 1), 50)
$$;

REVOKE ALL ON FUNCTION public.get_auction_bid_feed(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auction_bid_feed(uuid, integer) TO authenticated;

-- 2) email_verifications: codes must never be readable by clients
DROP POLICY IF EXISTS "own_verification_select" ON public.email_verifications;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_verifications FROM authenticated, anon;
GRANT ALL ON public.email_verifications TO service_role;