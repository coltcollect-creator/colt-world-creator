REVOKE EXECUTE ON FUNCTION public.search_public_profiles(text, integer) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.request_delivery(uuid, text, text) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_delivery(uuid, text, text) TO service_role;