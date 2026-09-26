
-- 1. Revoke EXECUTE from authenticated on internal-only SECURITY DEFINER function.
-- progress_quest is only meant to be invoked by other server-side SECURITY DEFINER
-- functions (purchase_product, etc.), not directly by signed-in users.
REVOKE EXECUTE ON FUNCTION public.progress_quest(text, integer) FROM authenticated, anon, PUBLIC;

-- 2. Hide sensitive order payment fields from client-facing selects.
-- payment_token / payment_reference can contain third-party payment provider
-- identifiers that should not be readable by the order owner via the Data API.
REVOKE SELECT (payment_token, payment_reference) ON public.orders FROM authenticated, anon;
-- service_role and owners (via owner-scoped access) retain full access.
GRANT SELECT (payment_token, payment_reference) ON public.orders TO service_role;
