
DROP POLICY IF EXISTS "platform_admin_read" ON public.platform_admins;
DROP POLICY IF EXISTS "plans_write_platform_admin" ON public.plans;
DROP POLICY IF EXISTS "subscriptions_platform_admin_all" ON public.subscriptions;
DROP POLICY IF EXISTS "usage_counters_owner_read" ON public.usage_counters;
DROP POLICY IF EXISTS "lock_events_own_read" ON public.lock_events;

DROP FUNCTION IF EXISTS public.is_platform_admin(uuid);

CREATE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

CREATE POLICY "platform_admin_read" ON public.platform_admins FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "plans_write_platform_admin" ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "subscriptions_platform_admin_all" ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "usage_counters_owner_read" ON public.usage_counters FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "lock_events_own_read" ON public.lock_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
