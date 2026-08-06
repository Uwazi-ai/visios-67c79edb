CREATE TABLE IF NOT EXISTS public.kova_org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.kova_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  permission text NOT NULL DEFAULT 'write' CHECK (permission IN ('read','write','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_org_members TO authenticated;
GRANT ALL ON public.kova_org_members TO service_role;

ALTER TABLE public.kova_org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.kova_org_members
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()));

CREATE POLICY platform_admin_read ON public.kova_org_members
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE TRIGGER trg_enforce_tenant_id BEFORE INSERT ON public.kova_org_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE INDEX IF NOT EXISTS kova_org_members_user_idx ON public.kova_org_members (user_id);

INSERT INTO public.kova_org_members (tenant_id, org_id, user_id, permission)
SELECT o.tenant_id, o.id, o.user_id, 'admin' FROM public.kova_orgs o
ON CONFLICT (org_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.my_kova_org_slugs()
RETURNS TABLE(slug text, permission text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.slug, m.permission
    FROM public.kova_org_members m
    JOIN public.kova_orgs o ON o.id = m.org_id
   WHERE m.user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.my_kova_org_slugs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_kova_org_slugs() TO authenticated;