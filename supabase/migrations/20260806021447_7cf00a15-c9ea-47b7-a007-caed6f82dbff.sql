-- Platform admin console: read-only overview + audited mutations.

CREATE OR REPLACE FUNCTION public.platform_tenant_overview()
RETURNS TABLE(
  id uuid, name text, slug text, plan text, seats int, seats_used bigint,
  ai_pool_limit int, status text, trial_ends_at timestamptz, created_at timestamptz,
  orgs_count bigint, tasks_count bigint, docs_count bigint, contacts_count bigint,
  last_activity timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.slug, t.plan, t.seats,
         (SELECT count(*) FROM public.tenant_users tu WHERE tu.tenant_id = t.id),
         t.ai_pool_limit, t.status, t.trial_ends_at, t.created_at,
         (SELECT count(*) FROM public.kova_orgs o WHERE o.tenant_id = t.id),
         (SELECT count(*) FROM public.kova_tasks k WHERE k.tenant_id = t.id),
         (SELECT count(*) FROM public.kova_documents d WHERE d.tenant_id = t.id),
         (SELECT count(*) FROM public.kova_contacts c WHERE c.tenant_id = t.id),
         GREATEST(
           (SELECT max(k.updated_at) FROM public.kova_tasks k WHERE k.tenant_id = t.id),
           (SELECT max(m.created_at) FROM public.kova_chat_messages m WHERE m.tenant_id = t.id)
         )
    FROM public.tenants t
   WHERE public.is_platform_admin()
   ORDER BY t.created_at;
$$;

REVOKE ALL ON FUNCTION public.platform_tenant_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_tenant_overview() TO authenticated;

-- Members of one tenant, for the detail drawer.
CREATE OR REPLACE FUNCTION public.platform_tenant_members(_tenant_id uuid)
RETURNS TABLE(user_id uuid, role text, email text, display_name text, joined_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tu.user_id, tu.role, p.email, p.display_name, tu.created_at
    FROM public.tenant_users tu
    LEFT JOIN public.profiles p ON p.id = tu.user_id
   WHERE tu.tenant_id = _tenant_id
     AND public.is_platform_admin()
   ORDER BY CASE tu.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, p.email;
$$;

REVOKE ALL ON FUNCTION public.platform_tenant_members(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_tenant_members(uuid) TO authenticated;

-- The only write path into tenants. Refuses non-admins, writes an audit row.
CREATE OR REPLACE FUNCTION public.platform_update_tenant(
  _tenant_id uuid,
  _plan text DEFAULT NULL,
  _seats int DEFAULT NULL,
  _ai_pool_limit int DEFAULT NULL,
  _status text DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE before_row public.tenants;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _plan IS NOT NULL AND _plan NOT IN ('trial','starter','growth','scale','enterprise') THEN
    RAISE EXCEPTION 'unknown plan';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('active','trialing','suspended','cancelled') THEN
    RAISE EXCEPTION 'unknown status';
  END IF;
  IF _seats IS NOT NULL AND _seats < 1 THEN
    RAISE EXCEPTION 'seats must be at least 1';
  END IF;

  SELECT * INTO before_row FROM public.tenants WHERE id = _tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found';
  END IF;

  UPDATE public.tenants SET
    plan = COALESCE(_plan, plan),
    seats = COALESCE(_seats, seats),
    ai_pool_limit = COALESCE(_ai_pool_limit, ai_pool_limit),
    status = COALESCE(_status, status)
  WHERE id = _tenant_id;

  INSERT INTO public.audit_log (actor_id, tenant_id, action, target, reason)
  VALUES (
    auth.uid(), _tenant_id, 'tenant.update', _tenant_id::text,
    COALESCE(_reason, '') || ' | ' ||
    format('plan %s→%s, seats %s→%s, ai %s→%s, status %s→%s',
      before_row.plan, COALESCE(_plan, before_row.plan),
      before_row.seats, COALESCE(_seats, before_row.seats),
      before_row.ai_pool_limit, COALESCE(_ai_pool_limit, before_row.ai_pool_limit),
      before_row.status, COALESCE(_status, before_row.status))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_update_tenant(uuid, text, int, int, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_update_tenant(uuid, text, int, int, text, text) TO authenticated;

-- Recent platform activity for the console's audit strip.
CREATE OR REPLACE FUNCTION public.platform_audit_recent(_limit int DEFAULT 50)
RETURNS TABLE(id uuid, actor_email text, tenant_name text, action text, target text, reason text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, p.email, t.name, a.action, a.target, a.reason, a.created_at
    FROM public.audit_log a
    LEFT JOIN public.profiles p ON p.id = a.actor_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
   WHERE public.is_platform_admin()
   ORDER BY a.created_at DESC
   LIMIT LEAST(COALESCE(_limit, 50), 200);
$$;

REVOKE ALL ON FUNCTION public.platform_audit_recent(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_audit_recent(int) TO authenticated;