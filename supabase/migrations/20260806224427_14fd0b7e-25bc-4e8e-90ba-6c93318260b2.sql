-- ============ helper: rows whose workspace the caller belongs to ============
-- (my_tenant_ids() already exists, security definer)

-- ============ fundraising_tasks ============
ALTER TABLE public.fundraising_tasks
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.fundraising_tasks t
   SET tenant_id = COALESCE(
     (SELECT o.tenant_id FROM public.fundraising_opportunities o WHERE o.id = t.opportunity_id),
     (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = t.created_by LIMIT 1),
     (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1))
 WHERE tenant_id IS NULL;

ALTER TABLE public.fundraising_tasks
  ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id(),
  ALTER COLUMN tenant_id SET NOT NULL;

DROP TRIGGER IF EXISTS trg_enforce_tenant_id ON public.fundraising_tasks;
CREATE TRIGGER trg_enforce_tenant_id BEFORE INSERT ON public.fundraising_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

DROP POLICY IF EXISTS "FundTasks: auth read" ON public.fundraising_tasks;
DROP POLICY IF EXISTS "FundTasks: auth insert" ON public.fundraising_tasks;
DROP POLICY IF EXISTS "FundTasks: auth update" ON public.fundraising_tasks;
DROP POLICY IF EXISTS "FundTasks: auth delete" ON public.fundraising_tasks;

CREATE POLICY "fundraising_tasks tenant read" ON public.fundraising_tasks
  FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY "fundraising_tasks tenant insert" ON public.fundraising_tasks
  FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY "fundraising_tasks tenant update" ON public.fundraising_tasks
  FOR UPDATE TO authenticated USING (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY "fundraising_tasks tenant delete" ON public.fundraising_tasks
  FOR DELETE TO authenticated USING (tenant_id IN (SELECT public.my_tenant_ids()));

-- ============ grant_proposals ============
ALTER TABLE public.grant_proposals
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.grant_proposals p
   SET tenant_id = COALESCE(
     (SELECT g.tenant_id FROM public.grant_opportunities g WHERE g.id = p.opportunity_id),
     (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1))
 WHERE tenant_id IS NULL;

ALTER TABLE public.grant_proposals
  ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id(),
  ALTER COLUMN tenant_id SET NOT NULL;

DROP TRIGGER IF EXISTS trg_enforce_tenant_id ON public.grant_proposals;
CREATE TRIGGER trg_enforce_tenant_id BEFORE INSERT ON public.grant_proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

DROP POLICY IF EXISTS "grant_proposals: authenticated read" ON public.grant_proposals;
DROP POLICY IF EXISTS "grant_proposals: authenticated write" ON public.grant_proposals;
DROP POLICY IF EXISTS "grant_proposals: authenticated update" ON public.grant_proposals;
DROP POLICY IF EXISTS "grant_proposals: authenticated delete" ON public.grant_proposals;

CREATE POLICY "grant_proposals tenant read" ON public.grant_proposals
  FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY "grant_proposals tenant insert" ON public.grant_proposals
  FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY "grant_proposals tenant update" ON public.grant_proposals
  FOR UPDATE TO authenticated USING (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()));
CREATE POLICY "grant_proposals tenant delete" ON public.grant_proposals
  FOR DELETE TO authenticated USING (tenant_id IN (SELECT public.my_tenant_ids()));

-- ============ social_* tables ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['social_posts','social_campaigns','social_analytics',
                           'social_team_members','social_comment_replies','social_ai_prompts']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', t);
  END LOOP;
END $$;

UPDATE public.social_posts s SET tenant_id = COALESCE(
  (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = s.created_by LIMIT 1),
  (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)) WHERE tenant_id IS NULL;
UPDATE public.social_campaigns s SET tenant_id = COALESCE(
  (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = s.created_by LIMIT 1),
  (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)) WHERE tenant_id IS NULL;
UPDATE public.social_analytics s SET tenant_id = COALESCE(
  (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = s.created_by LIMIT 1),
  (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)) WHERE tenant_id IS NULL;
UPDATE public.social_team_members s SET tenant_id = COALESCE(
  (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = s.user_id LIMIT 1),
  (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)) WHERE tenant_id IS NULL;
UPDATE public.social_comment_replies s SET tenant_id = COALESCE(
  (SELECT p.tenant_id FROM public.social_posts p WHERE p.id = s.post_id),
  (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)) WHERE tenant_id IS NULL;
UPDATE public.social_ai_prompts s SET tenant_id =
  (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['social_posts','social_campaigns','social_analytics',
                           'social_team_members','social_comment_replies','social_ai_prompts']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id(), ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_tenant_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_enforce_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id()', t);
  END LOOP;
END $$;

-- read policies: tenant scoped
DROP POLICY IF EXISTS sp_read ON public.social_posts;
CREATE POLICY sp_read ON public.social_posts FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sc_read ON public.social_campaigns;
CREATE POLICY sc_read ON public.social_campaigns FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sa_read ON public.social_analytics;
CREATE POLICY sa_read ON public.social_analytics FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS stm_read ON public.social_team_members;
CREATE POLICY stm_read ON public.social_team_members FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS scr_read ON public.social_comment_replies;
CREATE POLICY scr_read ON public.social_comment_replies FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sap_read ON public.social_ai_prompts;
CREATE POLICY sap_read ON public.social_ai_prompts FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()));

-- write policies: keep per-person ownership AND require same workspace
DROP POLICY IF EXISTS sp_insert_own ON public.social_posts;
CREATE POLICY sp_insert_own ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sp_update_own ON public.social_posts;
CREATE POLICY sp_update_own ON public.social_posts FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sp_delete_own ON public.social_posts;
CREATE POLICY sp_delete_own ON public.social_posts FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));

DROP POLICY IF EXISTS sc_insert_own ON public.social_campaigns;
CREATE POLICY sc_insert_own ON public.social_campaigns FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sc_update_own ON public.social_campaigns;
CREATE POLICY sc_update_own ON public.social_campaigns FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sc_delete_own ON public.social_campaigns;
CREATE POLICY sc_delete_own ON public.social_campaigns FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));

DROP POLICY IF EXISTS sa_insert_own ON public.social_analytics;
CREATE POLICY sa_insert_own ON public.social_analytics FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sa_update_own ON public.social_analytics;
CREATE POLICY sa_update_own ON public.social_analytics FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS sa_delete_own ON public.social_analytics;
CREATE POLICY sa_delete_own ON public.social_analytics FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));

DROP POLICY IF EXISTS stm_insert_own ON public.social_team_members;
CREATE POLICY stm_insert_own ON public.social_team_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS stm_update_own ON public.social_team_members;
CREATE POLICY stm_update_own ON public.social_team_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (user_id = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));
DROP POLICY IF EXISTS stm_delete_own ON public.social_team_members;
CREATE POLICY stm_delete_own ON public.social_team_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.my_tenant_ids()));

DROP POLICY IF EXISTS scr_write_post_owner ON public.social_comment_replies;
CREATE POLICY scr_write_post_owner ON public.social_comment_replies FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.my_tenant_ids()) AND EXISTS (
    SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND p.created_by = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.my_tenant_ids()) AND EXISTS (
    SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND p.created_by = auth.uid()));

DROP POLICY IF EXISTS sap_write_admin ON public.social_ai_prompts;
CREATE POLICY sap_write_admin ON public.social_ai_prompts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK (public.is_super_admin(auth.uid()) AND tenant_id IN (SELECT public.my_tenant_ids()));

-- ============ app_versions: hide release notes from non-admins ============
REVOKE SELECT ON public.app_versions FROM authenticated;
GRANT SELECT (id, version, released_at, created_at) ON public.app_versions TO authenticated;
GRANT INSERT (version, notes, released_by) ON public.app_versions TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_app_version_history(_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, version bigint, notes text, released_at timestamptz, released_by uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.version, v.notes, v.released_at, v.released_by
    FROM public.app_versions v
   WHERE public.is_super_admin(auth.uid())
   ORDER BY v.released_at DESC
   LIMIT LEAST(COALESCE(_limit, 10), 50);
$$;

REVOKE ALL ON FUNCTION public.admin_app_version_history(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_app_version_history(integer) TO authenticated;