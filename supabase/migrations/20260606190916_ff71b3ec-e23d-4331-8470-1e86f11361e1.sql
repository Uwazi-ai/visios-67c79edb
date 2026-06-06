
-- 1. Lock down anon access to orgs base table
DROP POLICY IF EXISTS "Orgs: anon read public fields" ON public.orgs;
REVOKE SELECT ON public.orgs FROM anon;
GRANT SELECT ON public.orgs_public TO anon;

-- 2. Lock down anon access to profiles base table
DROP POLICY IF EXISTS "Profiles: anon read public-card rows" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT ON public.profiles_public TO anon;

-- 3. social_platform_tokens: prevent user_id mutation
DROP POLICY IF EXISTS users_own_tokens ON public.social_platform_tokens;
CREATE POLICY "spt_select_own" ON public.social_platform_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "spt_insert_own" ON public.social_platform_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "spt_update_own" ON public.social_platform_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "spt_delete_own" ON public.social_platform_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. visi_migration_tasks: restrict writes to super admin only
DROP POLICY IF EXISTS "visi_migration_tasks auth all" ON public.visi_migration_tasks;
CREATE POLICY "vmt_read_auth" ON public.visi_migration_tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "vmt_write_admin" ON public.visi_migration_tasks
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. social_* tables: restrict writes to creator/owner
-- social_posts
DROP POLICY IF EXISTS "social_posts auth all" ON public.social_posts;
CREATE POLICY "sp_read" ON public.social_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "sp_insert_own" ON public.social_posts FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "sp_update_own" ON public.social_posts FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "sp_delete_own" ON public.social_posts FOR DELETE TO authenticated USING (created_by = auth.uid());

-- social_campaigns
DROP POLICY IF EXISTS "social_campaigns auth all" ON public.social_campaigns;
CREATE POLICY "sc_read" ON public.social_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "sc_insert_own" ON public.social_campaigns FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "sc_update_own" ON public.social_campaigns FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "sc_delete_own" ON public.social_campaigns FOR DELETE TO authenticated USING (created_by = auth.uid());

-- social_analytics
DROP POLICY IF EXISTS "social_analytics auth all" ON public.social_analytics;
CREATE POLICY "sa_read" ON public.social_analytics FOR SELECT TO authenticated USING (true);
CREATE POLICY "sa_insert_own" ON public.social_analytics FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "sa_update_own" ON public.social_analytics FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "sa_delete_own" ON public.social_analytics FOR DELETE TO authenticated USING (created_by = auth.uid());

-- social_team_members
DROP POLICY IF EXISTS "social_team_members auth all" ON public.social_team_members;
CREATE POLICY "stm_read" ON public.social_team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "stm_insert_own" ON public.social_team_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "stm_update_own" ON public.social_team_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "stm_delete_own" ON public.social_team_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- social_comment_replies (scoped via post ownership)
DROP POLICY IF EXISTS "social_comment_replies auth all" ON public.social_comment_replies;
CREATE POLICY "scr_read" ON public.social_comment_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "scr_write_post_owner" ON public.social_comment_replies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = social_comment_replies.post_id AND p.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = social_comment_replies.post_id AND p.created_by = auth.uid()));

-- social_ai_prompts (no creator col — restrict writes to super admin, read open)
DROP POLICY IF EXISTS "social_ai_prompts auth all" ON public.social_ai_prompts;
CREATE POLICY "sap_read" ON public.social_ai_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "sap_write_admin" ON public.social_ai_prompts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
