REVOKE EXECUTE ON FUNCTION public.credit_gem_pack(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_gem_pack(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_gem_pack(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_gem_pack(uuid, text) TO service_role;