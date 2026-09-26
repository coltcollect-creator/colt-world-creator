CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name text,
  status text NOT NULL DEFAULT 'active',
  terms_version text NOT NULL DEFAULT 'v1',
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_read_own ON public.vendors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());

CREATE POLICY vendors_join_self ON public.vendors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY vendors_update_own ON public.vendors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_owner())
  WITH CHECK (user_id = auth.uid() OR public.is_owner());

ALTER TABLE public.products
  ADD COLUMN vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN vendor_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN set_name text;

CREATE UNIQUE INDEX products_vendor_unique_name
  ON public.products (vendor_id, lower(name))
  WHERE vendor_id IS NOT NULL;

CREATE INDEX products_vendor_idx ON public.products (vendor_id) WHERE vendor_id IS NOT NULL;

CREATE POLICY products_vendor_read_own ON public.products
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.user_id = auth.uid()));

CREATE POLICY products_vendor_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.user_id = auth.uid() AND v.status = 'active')
    AND vendor_status = 'pending'
    AND active = false
  );

CREATE POLICY products_vendor_update_pending ON public.products
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.user_id = auth.uid()) AND vendor_status = 'pending')
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.user_id = auth.uid())
    AND vendor_status = 'pending'
    AND active = false
  );

CREATE POLICY products_vendor_delete_pending ON public.products
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.user_id = auth.uid()) AND vendor_status = 'pending');

ALTER TABLE public.game_settings
  ADD COLUMN vendor_terms_url text,
  ADD COLUMN vendor_terms_text text,
  ADD COLUMN vendor_program_enabled boolean NOT NULL DEFAULT true;
