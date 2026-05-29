
-- Settings key-value store
CREATE TABLE IF NOT EXISTS public.visi_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text,
  is_secret boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visi_settings TO authenticated;
GRANT ALL ON public.visi_settings TO service_role;

ALTER TABLE public.visi_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visi_settings auth all" ON public.visi_settings
  FOR ALL TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.visi_settings (key, value, is_secret) VALUES
  ('make_api_key',          '',              true),
  ('make_region',           'us1',           false),
  ('make_team_id',          '',              false),
  ('make_folder_id',        '',              false),
  ('slack_channel_default', '#marketing',    false),
  ('report_email',          'myke@uwazi.ai', false)
ON CONFLICT (key) DO NOTHING;

-- Agent registry
CREATE TABLE IF NOT EXISTS public.visi_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text CHECK (category IN ('content','campaigns','analytics','approvals','reports','general')),
  make_scenario_id text UNIQUE,
  make_scenario_url text,
  trigger_type text CHECK (trigger_type IN ('schedule','webhook','manual')),
  trigger_config jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  is_prebuilt boolean DEFAULT true,
  template_key text,
  assigned_to text[] DEFAULT ARRAY['myke'],
  brand text[] DEFAULT ARRAY['uwazi','bin','myke'],
  last_run_at timestamptz,
  last_run_status text CHECK (last_run_status IN ('success','failed','running','warning')),
  run_count integer DEFAULT 0,
  ai_prompt text,
  created_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visi_agents TO authenticated;
GRANT ALL ON public.visi_agents TO service_role;

ALTER TABLE public.visi_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visi_agents auth all" ON public.visi_agents
  FOR ALL TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_agents_category ON public.visi_agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_active ON public.visi_agents(is_active);

INSERT INTO public.visi_agents (name, description, category, template_key, trigger_type, assigned_to) VALUES
  ('Weekly analytics digest','Mon 8am: metrics → Claude → Slack #marketing','analytics','weekly-analytics-digest','schedule',ARRAY['anna','alexis','myke']),
  ('Content approval flow','Post pending → Slack to Myke with Approve/Reject buttons','approvals','content-approval-flow','webhook',ARRAY['anna','alexis','myke']),
  ('Comment reply queue','New comment → Claude draft → Alexis reviews → posts','content','comment-reply-queue','webhook',ARRAY['alexis']),
  ('Content calendar generator','New campaign → Claude 2-week calendar → draft posts','content','content-calendar-generator','webhook',ARRAY['anna','alexis']),
  ('Campaign launch checklist','Campaign active → check creatives+budget → Slack','campaigns','campaign-launch-checklist','webhook',ARRAY['anna','alexis','myke']),
  ('Post performance alert','Daily 9am: yesterday posts → alert on under/overperformers','analytics','post-performance-alert','schedule',ARRAY['anna','alexis']),
  ('Weekly brand report','Fri 4pm: full metrics → Claude → email to Myke','reports','weekly-brand-report','schedule',ARRAY['myke']),
  ('Creative brief fix','Daily 10am: creatives score <50 → Claude brief → Slack to Anna','campaigns','creative-brief-on-underperformer','schedule',ARRAY['anna'])
ON CONFLICT DO NOTHING;

-- Run history
CREATE TABLE IF NOT EXISTS public.visi_agent_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid REFERENCES public.visi_agents(id) ON DELETE CASCADE,
  make_execution_id text,
  status text CHECK (status IN ('success','failed','running','warning')),
  triggered_by text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  output_summary text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visi_agent_runs TO authenticated;
GRANT ALL ON public.visi_agent_runs TO service_role;

ALTER TABLE public.visi_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visi_agent_runs auth all" ON public.visi_agent_runs
  FOR ALL TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_runs_agent ON public.visi_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_runs_created ON public.visi_agent_runs(created_at DESC);

-- n8n → Make migration tracker
CREATE TABLE IF NOT EXISTS public.visi_migration_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_name text NOT NULL,
  workflow_description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','complete','skipped')),
  make_scenario_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visi_migration_tasks TO authenticated;
GRANT ALL ON public.visi_migration_tasks TO service_role;

ALTER TABLE public.visi_migration_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visi_migration_tasks auth all" ON public.visi_migration_tasks
  FOR ALL TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.visi_migration_tasks (workflow_name, workflow_description) VALUES
  ('Morning briefing','Daily 7am: Gmail + Calendar + Supabase → Claude brief → WhatsApp/Ray-Ban'),
  ('Gmail/Calendar sync','Every 30 min: new emails categorized → Supabase context update'),
  ('Partnership health check','Every Monday: Supabase records → Claude health score → Slack to Myke')
ON CONFLICT DO NOTHING;
