REVOKE EXECUTE ON FUNCTION public.my_tenant_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.default_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_tenant_ids(), public.current_tenant_id(),
  public.is_platform_admin(), public.default_tenant_id() TO authenticated, service_role;