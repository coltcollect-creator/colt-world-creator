-- 1) game_settings: hide pickup_address from anonymous visitors via column-level grants
REVOKE SELECT ON public.game_settings FROM anon;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'game_settings' AND column_name <> 'pickup_address';
  EXECUTE format('GRANT SELECT (%s) ON public.game_settings TO anon', cols);
END $$;
GRANT SELECT ON public.game_settings TO authenticated;
GRANT ALL ON public.game_settings TO service_role;

-- 2) auctions / auction_bids: no direct writes by regular authenticated users.
--    Bids are placed only through place_auction_bid (SECURITY DEFINER).
REVOKE INSERT, UPDATE, DELETE ON public.auction_bids FROM authenticated, anon;
GRANT SELECT ON public.auction_bids TO authenticated;
GRANT ALL ON public.auction_bids TO service_role;

DROP POLICY IF EXISTS auction_bids_owner_all ON public.auction_bids;
CREATE POLICY auction_bids_owner_read ON public.auction_bids
  FOR SELECT TO authenticated USING (public.is_owner());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auctions TO authenticated;
GRANT ALL ON public.auctions TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.auctions FROM anon;

-- Restrict auction writes to store owners only (already via policy); ensure no permissive write policy exists
DROP POLICY IF EXISTS auctions_write_authenticated ON public.auctions;

-- 3) email_verifications: explicit deny of all client writes; only SECURITY DEFINER RPCs may write
REVOKE INSERT, UPDATE, DELETE ON public.email_verifications FROM authenticated, anon;
GRANT SELECT ON public.email_verifications TO authenticated;
GRANT ALL ON public.email_verifications TO service_role;

DROP POLICY IF EXISTS email_verifications_no_insert ON public.email_verifications;
DROP POLICY IF EXISTS email_verifications_no_update ON public.email_verifications;
DROP POLICY IF EXISTS email_verifications_no_delete ON public.email_verifications;
CREATE POLICY email_verifications_no_insert ON public.email_verifications
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY email_verifications_no_update ON public.email_verifications
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY email_verifications_no_delete ON public.email_verifications
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- Same restrictive guard for auction_bids to block any future permissive write policy
DROP POLICY IF EXISTS auction_bids_no_client_writes ON public.auction_bids;
CREATE POLICY auction_bids_no_client_writes ON public.auction_bids
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);