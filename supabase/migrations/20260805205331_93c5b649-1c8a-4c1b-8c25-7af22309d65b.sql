-- =========================================================
-- 1. CORE TENANCY TABLES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'trial',
  seats integer NOT NULL DEFAULT 1,
  ai_pool_limit integer NOT NULL DEFAULT 500,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT now() + interval '14 days'
);
GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT ON public.tenant_users TO authenticated;
GRANT ALL ON public.tenant_users TO service_role;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  target text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  permission text NOT NULL DEFAULT 'write' CHECK (permission IN ('read','write','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. ORGS: tenant ownership + new fields
-- =========================================================
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role_label text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- =========================================================
-- 3. SEED THE FIRST TENANT
-- =========================================================
INSERT INTO public.tenants (name, slug, plan, seats, ai_pool_limit, status, trial_ends_at)
VALUES ('Kova', 'kova', 'growth', 25, 100000, 'active', '2099-01-01T00:00:00Z')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tenant_users (tenant_id, user_id, role)
SELECT t.id, p.id,
       CASE WHEN lower(p.email) = 'myke@uwazi.ai' THEN 'owner' ELSE 'member' END
FROM public.tenants t, public.profiles p
WHERE t.slug = 'kova'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO public.platform_admins (user_id)
SELECT id FROM public.profiles WHERE lower(email) = 'myke@uwazi.ai'
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.orgs SET tenant_id = (SELECT id FROM public.tenants WHERE slug='kova')
WHERE tenant_id IS NULL;

INSERT INTO public.orgs (name, slug, color, tenant_id, created_by, role_label)
SELECT v.name, v.slug, v.color,
       (SELECT id FROM public.tenants WHERE slug='kova'),
       (SELECT id FROM public.profiles WHERE lower(email)='myke@uwazi.ai'),
       v.role_label
FROM (VALUES
  ('Raia Ventures','raia-ventures','#8B5CF6','Founder'),
  ('1Flock','1flock','#F59E0B','Founder'),
  ('Kova','kova','#2563EB','Platform')
) AS v(name, slug, color, role_label)
WHERE NOT EXISTS (SELECT 1 FROM public.orgs o WHERE o.slug = v.slug);

ALTER TABLE public.orgs ALTER COLUMN tenant_id SET NOT NULL;

INSERT INTO public.org_members (org_id, user_id, permission)
SELECT m.org_id, m.user_id,
       CASE WHEN m.role IN ('owner','admin') THEN 'admin' ELSE 'write' END
FROM public.org_memberships m
ON CONFLICT (org_id, user_id) DO NOTHING;

-- =========================================================
-- 4. HELPER FUNCTIONS (server-derived tenancy; never client input)
-- =========================================================
CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_users
   WHERE user_id = auth.uid()
   ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.default_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_tenant_id(), (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1));
$$;

-- Server-side enforcement: a signed-in caller can never choose their tenant_id.
CREATE OR REPLACE FUNCTION public.enforce_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    t := public.current_tenant_id();
    IF t IS NOT NULL THEN
      NEW.tenant_id := t;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_tenant_ids(), public.current_tenant_id(),
  public.is_platform_admin(), public.default_tenant_id() TO authenticated, service_role;

-- =========================================================
-- 5. TENANT_ID ON EVERY TENANT-OWNED TABLE + BACKFILL + RLS
-- =========================================================
DO $do$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'tasks','contacts','messages','kb_documents','kb_chunks','visi_agents',
    'visi_agent_runs','agent_requests','integrations','bookings',
    'fundraising_opportunities','grant_opportunities'
  ];
  seed uuid := (SELECT id FROM public.tenants WHERE slug='kova');
  has_org boolean;
  pol record;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE', tbl);

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=tbl AND column_name='org_id'
    ) INTO has_org;

    IF has_org THEN
      EXECUTE format(
        'UPDATE public.%I t SET tenant_id = o.tenant_id FROM public.orgs o
          WHERE t.org_id = o.id AND t.tenant_id IS NULL', tbl);
    END IF;

    -- Suspend legacy triggers during backfill (some reference columns that no longer exist)
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', tbl);
    IF has_org THEN
      EXECUTE format(
        'UPDATE public.%I t SET tenant_id = o.tenant_id FROM public.orgs o
          WHERE t.org_id = o.id AND t.tenant_id IS NULL', tbl);
    END IF;
    EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL', tbl) USING seed;
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id()', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', 'idx_'||tbl||'_tenant', tbl);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_tenant_id ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_tenant_id BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id()', tbl);

    -- Replace all legacy policies with the two-policy tenancy model
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- tenant path: simple, correct on its own
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO authenticated
         USING (tenant_id IN (SELECT public.my_tenant_ids()))
         WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()))', tbl);

    -- platform path: explicit, separate
    EXECUTE format(
      'CREATE POLICY platform_admin_read ON public.%I FOR SELECT TO authenticated
         USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()))', tbl);
  END LOOP;
END
$do$;

-- Public booking submissions (anonymous invitees) remain possible.
CREATE POLICY public_booking_insert ON public.bookings FOR INSERT TO anon
  WITH CHECK (
    event_type_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.event_types et WHERE et.id = event_type_id AND et.active = true)
  );
GRANT INSERT ON public.bookings TO anon;

-- =========================================================
-- 6. POLICIES FOR THE TENANCY TABLES THEMSELVES
-- =========================================================
CREATE POLICY tenant_isolation ON public.tenants FOR SELECT TO authenticated
  USING (id IN (SELECT public.my_tenant_ids()));
CREATE POLICY platform_admin_read ON public.tenants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY tenant_isolation ON public.tenant_users FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY platform_admin_read ON public.tenant_users FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY platform_admin_read ON public.platform_admins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY tenant_isolation ON public.org_members FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM public.orgs WHERE tenant_id IN (SELECT public.my_tenant_ids())))
  WITH CHECK (org_id IN (SELECT id FROM public.orgs WHERE tenant_id IN (SELECT public.my_tenant_ids())));
CREATE POLICY platform_admin_read ON public.org_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

CREATE POLICY tenant_isolation ON public.audit_log FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY tenant_write ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY platform_admin_read ON public.audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

-- Orgs are tenant-scoped too
DO $do$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='orgs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orgs', pol.policyname);
  END LOOP;
END
$do$;
ALTER TABLE public.orgs ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id();
DROP TRIGGER IF EXISTS trg_enforce_tenant_id ON public.orgs;
CREATE TRIGGER trg_enforce_tenant_id BEFORE INSERT ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();
CREATE POLICY tenant_isolation ON public.orgs FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY platform_admin_read ON public.orgs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));