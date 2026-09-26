ALTER TABLE public.credit_packages ALTER COLUMN currency SET DEFAULT 'ILS';
UPDATE public.credit_packages SET currency='ILS' WHERE currency IS NULL OR currency <> 'ILS';