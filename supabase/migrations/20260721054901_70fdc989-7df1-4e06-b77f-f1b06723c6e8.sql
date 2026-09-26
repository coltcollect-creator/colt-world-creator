
-- 1) Add missing cosmetics columns (rarity, color_hex) + auto-slug
ALTER TABLE public.cosmetics
  ADD COLUMN IF NOT EXISTS rarity text DEFAULT 'common',
  ADD COLUMN IF NOT EXISTS color_hex text;

ALTER TABLE public.cosmetics ALTER COLUMN slug DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_cosmetics_autoslug()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE base text; final text; i int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := lower(regexp_replace(coalesce(NEW.name, 'cosmetic'), '[^a-zA-Z0-9]+', '-', 'g'));
    base := trim(both '-' from base);
    IF base = '' THEN base := 'cosmetic'; END IF;
    final := base;
    WHILE EXISTS (SELECT 1 FROM public.cosmetics WHERE slug = final AND id <> NEW.id) LOOP
      i := i + 1; final := base || '-' || i::text;
    END LOOP;
    NEW.slug := final;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_cosmetics_autoslug ON public.cosmetics;
CREATE TRIGGER tg_cosmetics_autoslug BEFORE INSERT OR UPDATE ON public.cosmetics
  FOR EACH ROW EXECUTE FUNCTION public.tg_cosmetics_autoslug();

-- 2) Products: subcategory + multi-store
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS store_ids uuid[] DEFAULT '{}'::uuid[];

-- 3) Product categories table (hierarchical: parent for subcategories)
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories readable" ON public.product_categories;
CREATE POLICY "product_categories readable" ON public.product_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_categories owner writes" ON public.product_categories;
CREATE POLICY "product_categories owner writes" ON public.product_categories FOR ALL
  TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
