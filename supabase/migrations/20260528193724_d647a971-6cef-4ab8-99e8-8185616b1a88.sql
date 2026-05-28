
-- Social module tables
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  platform text NOT NULL,
  format text,
  content_pillar text,
  hook text,
  caption text,
  hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  script_outline jsonb,
  media_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  assigned_to text,
  status text NOT NULL DEFAULT 'draft',
  ai_generated boolean NOT NULL DEFAULT false,
  external_post_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  name text NOT NULL,
  description text,
  start_date date,
  end_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  role text NOT NULL,
  initials text NOT NULL,
  color text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{"draft":true,"schedule":true,"post":false,"approve":false,"delete":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL UNIQUE,
  voice_notes text,
  pillars jsonb NOT NULL DEFAULT '[]'::jsonb,
  require_approval boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_comment_id text,
  author text,
  comment_text text,
  reply_text text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

CREATE TABLE IF NOT EXISTS public.social_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  platform text NOT NULL,
  date_range_start date,
  date_range_end date,
  raw_input text,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_campaigns TO authenticated;
GRANT ALL ON public.social_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_team_members TO authenticated;
GRANT ALL ON public.social_team_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_ai_prompts TO authenticated;
GRANT ALL ON public.social_ai_prompts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comment_replies TO authenticated;
GRANT ALL ON public.social_comment_replies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_integrations TO authenticated;
GRANT ALL ON public.social_integrations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_analytics TO authenticated;
GRANT ALL ON public.social_analytics TO service_role;

-- RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_analytics ENABLE ROW LEVEL SECURITY;

-- Shared workspace: any authenticated user can read/write social content
CREATE POLICY "social_posts auth all" ON public.social_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "social_campaigns auth all" ON public.social_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "social_team_members auth all" ON public.social_team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "social_ai_prompts auth all" ON public.social_ai_prompts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "social_comment_replies auth all" ON public.social_comment_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "social_analytics auth all" ON public.social_analytics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Integrations: user-scoped
CREATE POLICY "social_integrations self read" ON public.social_integrations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "social_integrations self insert" ON public.social_integrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "social_integrations self update" ON public.social_integrations FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "social_integrations self delete" ON public.social_integrations FOR DELETE TO authenticated USING (user_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER social_posts_updated BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER social_ai_prompts_updated BEFORE UPDATE ON public.social_ai_prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_social_posts_brand_sched ON public.social_posts(brand, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts(status);

-- Seed brand voices + pillars
INSERT INTO public.social_ai_prompts (brand, voice_notes, pillars) VALUES
  ('uwazi', 'Bold, urgent, empowering, nonpartisan, youth-native. Never partisan. Plain language. Civic urgency without alarm.',
    '["Voter Education","Civic Myths Busted","Platform Demo","Community Voice","Election Countdown"]'::jsonb),
  ('bin', 'Community-first, celebratory, culturally fluent, unapologetic. No corporate DEI-speak.',
    '["Member Spotlights","Resources & Opportunities","Community Events","Industry Insights","Culture & Celebration"]'::jsonb),
  ('myke', 'Authentic, multi-dimensional, direct, builder energy. Never generic founder content.',
    '["Build in Public","Civic Tech POV","KC Founder Life","Lessons Learned","Collaborations & Shoutouts"]'::jsonb)
ON CONFLICT (brand) DO NOTHING;

INSERT INTO public.social_team_members (name, role, initials, color) VALUES
  ('Anna', 'Head of Brand', 'AN', '#185FA5'),
  ('Alexis', 'Head of Content Strategy & Comms', 'AL', '#534AB7'),
  ('Myke', 'Founder', 'MY', '#3B6D11')
ON CONFLICT DO NOTHING;
