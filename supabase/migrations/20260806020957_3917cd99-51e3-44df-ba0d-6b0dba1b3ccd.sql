DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kova_tasks','kova_proposals','kova_agents','kova_agent_runs','kova_documents',
    'kova_doc_chunks','kova_contacts','kova_chat_messages','kova_tool_calls',
    'kova_connections','kova_permissions','kova_board_states','kova_orgs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE', t);
    EXECUTE format($f$
      UPDATE public.%I x SET tenant_id = COALESCE(
        (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = x.user_id
          ORDER BY CASE tu.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1),
        (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1))
      WHERE x.tenant_id IS NULL$f$, t);
    EXECUTE format('DELETE FROM public.%I WHERE tenant_id IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', t || '_tenant_idx', t);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'own ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS platform_admin_read ON public.%I', t);

    EXECUTE format($p$CREATE POLICY tenant_isolation ON public.%I
      AS PERMISSIVE FOR ALL TO authenticated
      USING (tenant_id IN (SELECT public.my_tenant_ids()))
      WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()))$p$, t);

    EXECUTE format($p$CREATE POLICY platform_admin_read ON public.%I
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()))$p$, t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_tenant_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_enforce_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id()', t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.my_org_memberships()
RETURNS TABLE(org_id uuid, permission text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.org_id, m.permission FROM public.org_members m WHERE m.user_id = auth.uid()
  UNION
  SELECT m.org_id, CASE m.role WHEN 'owner' THEN 'admin' ELSE 'write' END
    FROM public.org_memberships m WHERE m.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_org_memberships() TO authenticated;