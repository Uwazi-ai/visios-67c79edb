-- =========================================================================
-- 1. PROFILES — remove public read, expose only safe fields via a view
-- =========================================================================
DROP POLICY IF EXISTS "Profiles: public read by username" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  title,
  company,
  tagline,
  linkedin_url,
  website_url,
  card_theme,
  custom_links,
  primary_org_id
FROM public.profiles
WHERE username IS NOT NULL;

-- The view runs as the caller, so we need a SELECT policy that allows anon
-- to read the underlying rows ONLY for profiles that have a username.
-- We restrict columns by using the view + revoking direct table grants for anon.
CREATE POLICY "Profiles: anon read public-card rows"
ON public.profiles
FOR SELECT
TO anon
USING (username IS NOT NULL);

-- Lock down what anon can actually pull from the base table to just the
-- columns the view exposes. (Authenticated users still get full self-read
-- via existing "Profiles: self read" and "Profiles: shared org read" policies.)
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT
  (id, username, display_name, avatar_url, title, company, tagline,
   linkedin_url, website_url, card_theme, custom_links, primary_org_id)
  ON public.profiles TO anon;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- =========================================================================
-- 2. ORGS — remove anon read, expose minimal public view
-- =========================================================================
DROP POLICY IF EXISTS "Orgs: public read" ON public.orgs;

CREATE OR REPLACE VIEW public.orgs_public
WITH (security_invoker = on) AS
SELECT id, slug, name, color
FROM public.orgs;

-- Allow anon to resolve org slug/name/color (needed by public card + booking pages),
-- but only those four columns — strategy fields stay hidden.
CREATE POLICY "Orgs: anon read public fields"
ON public.orgs
FOR SELECT
TO anon
USING (true);

REVOKE SELECT ON public.orgs FROM anon;
GRANT SELECT (id, slug, name, color) ON public.orgs TO anon;

GRANT SELECT ON public.orgs_public TO anon, authenticated;

-- =========================================================================
-- 3. VISI_SETTINGS — service role only (contains secrets)
-- =========================================================================
DROP POLICY IF EXISTS "visi_settings auth all" ON public.visi_settings;

ALTER TABLE public.visi_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visi_settings: service role only"
ON public.visi_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON public.visi_settings FROM anon, authenticated;
GRANT ALL ON public.visi_settings TO service_role;

-- =========================================================================
-- 4. VISI_AGENTS / VISI_AGENT_RUNS — read-only for authenticated, writes via service role
-- =========================================================================
DROP POLICY IF EXISTS "visi_agents auth all" ON public.visi_agents;
DROP POLICY IF EXISTS "visi_agent_runs auth all" ON public.visi_agent_runs;

ALTER TABLE public.visi_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visi_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visi_agents: authenticated read"
ON public.visi_agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "visi_agents: service role write"
ON public.visi_agents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "visi_agent_runs: authenticated read"
ON public.visi_agent_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "visi_agent_runs: service role write"
ON public.visi_agent_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.visi_agents FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.visi_agent_runs FROM authenticated, anon;
GRANT SELECT ON public.visi_agents TO authenticated;
GRANT SELECT ON public.visi_agent_runs TO authenticated;
GRANT ALL ON public.visi_agents TO service_role;
GRANT ALL ON public.visi_agent_runs TO service_role;

-- =========================================================================
-- 5. AGENT_REQUESTS — enable RLS, service role only
-- =========================================================================
ALTER TABLE public.agent_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_requests: service role only"
ON public.agent_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.agent_requests FROM anon, authenticated;
GRANT ALL ON public.agent_requests TO service_role;

-- =========================================================================
-- 6. GROWTH_AGENT_LOGS — enable RLS, service role only
-- =========================================================================
ALTER TABLE public.growth_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "growth_agent_logs: service role only"
ON public.growth_agent_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.growth_agent_logs FROM anon, authenticated;
GRANT ALL ON public.growth_agent_logs TO service_role;

-- =========================================================================
-- 7. GRANT_OPPORTUNITIES / GRANT_PROPOSALS — restrict from public to authenticated
-- =========================================================================
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.grant_opportunities;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.grant_proposals;

CREATE POLICY "grant_opportunities: authenticated read"
ON public.grant_opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "grant_opportunities: authenticated write"
ON public.grant_opportunities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "grant_opportunities: authenticated update"
ON public.grant_opportunities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "grant_opportunities: authenticated delete"
ON public.grant_opportunities FOR DELETE TO authenticated USING (true);

CREATE POLICY "grant_proposals: authenticated read"
ON public.grant_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "grant_proposals: authenticated write"
ON public.grant_proposals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "grant_proposals: authenticated update"
ON public.grant_proposals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "grant_proposals: authenticated delete"
ON public.grant_proposals FOR DELETE TO authenticated USING (true);

REVOKE ALL ON public.grant_opportunities FROM anon;
REVOKE ALL ON public.grant_proposals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_proposals TO authenticated;

-- =========================================================================
-- 8. MCP_APPROVALS — require non-null org_id, only org members can see/modify
-- =========================================================================
DROP POLICY IF EXISTS "Approvals: org read"   ON public.mcp_approvals;
DROP POLICY IF EXISTS "Approvals: org update" ON public.mcp_approvals;
DROP POLICY IF EXISTS "Approvals: org write"  ON public.mcp_approvals;

CREATE POLICY "mcp_approvals: org member read"
ON public.mcp_approvals FOR SELECT TO authenticated
USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "mcp_approvals: org member insert"
ON public.mcp_approvals FOR INSERT TO authenticated
WITH CHECK (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "mcp_approvals: org member update"
ON public.mcp_approvals FOR UPDATE TO authenticated
USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id))
WITH CHECK (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "mcp_approvals: service role full"
ON public.mcp_approvals FOR ALL TO service_role USING (true) WITH CHECK (true);