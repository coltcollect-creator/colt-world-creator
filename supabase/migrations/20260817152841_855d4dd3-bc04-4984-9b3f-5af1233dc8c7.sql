-- Auctions
DROP POLICY IF EXISTS auctions_public_read ON public.auctions;
CREATE POLICY auctions_read_authenticated ON public.auctions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS auction_bids_public_read ON public.auction_bids;
CREATE POLICY auction_bids_read_authenticated ON public.auction_bids FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.auctions FROM anon;
REVOKE SELECT ON public.auction_bids FROM anon;

-- Catalog
DROP POLICY IF EXISTS "Anyone can view roles" ON public.character_roles;
CREATE POLICY "Authenticated can view roles" ON public.character_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Anyone can view characters" ON public.characters;
CREATE POLICY "Authenticated can view characters" ON public.characters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_categories readable" ON public.product_categories;
CREATE POLICY "product_categories readable authenticated" ON public.product_categories FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.character_roles FROM anon;
REVOKE SELECT ON public.characters FROM anon;
REVOKE SELECT ON public.product_categories FROM anon;

-- Owner manage policies scoped to authenticated
DROP POLICY IF EXISTS "Owner manage roles" ON public.character_roles;
CREATE POLICY "Owner manage roles" ON public.character_roles FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
DROP POLICY IF EXISTS "Owner manage characters" ON public.characters;
CREATE POLICY "Owner manage characters" ON public.characters FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());

-- Maps
DROP POLICY IF EXISTS mv_read_published ON public.map_versions;
CREATE POLICY mv_read_published ON public.map_versions FOR SELECT TO authenticated
USING ((status = 'published') OR is_owner());
DROP POLICY IF EXISTS mo_read_published ON public.map_objects;
CREATE POLICY mo_read_published ON public.map_objects FOR SELECT TO authenticated
USING (is_owner() OR EXISTS (SELECT 1 FROM public.map_versions v WHERE v.id = map_objects.map_version_id AND v.status = 'published'));
REVOKE SELECT ON public.map_versions FROM anon;
REVOKE SELECT ON public.map_objects FROM anon;