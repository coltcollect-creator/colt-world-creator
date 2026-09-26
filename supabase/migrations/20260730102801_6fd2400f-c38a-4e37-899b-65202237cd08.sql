ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sale_credit_price integer,
  ADD COLUMN IF NOT EXISTS regular_price numeric,
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS woo_product_id bigint,
  ADD COLUMN IF NOT EXISTS woo_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS products_woo_product_id_key ON public.products (woo_product_id) WHERE woo_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_name_ci_idx ON public.products (lower(name));

CREATE OR REPLACE FUNCTION public.tg_products_stock_out()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT NEW.unlimited_stock AND COALESCE(NEW.stock, 0) <= 0 THEN
    NEW.active := false;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.tg_products_stock_out() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS products_stock_out ON public.products;
CREATE TRIGGER products_stock_out
BEFORE INSERT OR UPDATE OF stock, unlimited_stock ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_products_stock_out();