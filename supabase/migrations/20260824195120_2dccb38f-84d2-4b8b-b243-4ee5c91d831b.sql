ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_related_product_fkey;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_related_product_fkey FOREIGN KEY (related_product) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.live_rips DROP CONSTRAINT IF EXISTS live_rips_product_id_fkey;
ALTER TABLE public.live_rips ADD CONSTRAINT live_rips_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;