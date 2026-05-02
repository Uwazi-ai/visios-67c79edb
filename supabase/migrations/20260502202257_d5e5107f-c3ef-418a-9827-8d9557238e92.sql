-- Per-user agent configuration
CREATE TABLE IF NOT EXISTS public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  gmail_contact_sync_enabled boolean NOT NULL DEFAULT false,
  gmail_sync_frequency_hours integer NOT NULL DEFAULT 24,
  gmail_sync_lookback_days integer NOT NULL DEFAULT 7,
  gmail_auto_approve_known_domains boolean NOT NULL DEFAULT false,
  gmail_min_email_count integer NOT NULL DEFAULT 1,
  gmail_last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AgentSettings: self read"
  ON public.agent_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "AgentSettings: self insert"
  ON public.agent_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "AgentSettings: self update"
  ON public.agent_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_agent_settings_updated_at
  BEFORE UPDATE ON public.agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Discovered contacts awaiting review
CREATE TABLE IF NOT EXISTS public.contact_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  title text,
  company text,
  phone text,
  linkedin_url text,
  suggested_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  email_count integer NOT NULL DEFAULT 1,
  last_email_date timestamptz,
  confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
  raw_signature text,
  sample_subject text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'skipped')),
  source text NOT NULL DEFAULT 'gmail_agent',
  thread_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_review_queue_user_status
  ON public.contact_review_queue (user_id, status);

ALTER TABLE public.contact_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ReviewQueue: self read"
  ON public.contact_review_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ReviewQueue: self insert"
  ON public.contact_review_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ReviewQueue: self update"
  ON public.contact_review_queue FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ReviewQueue: self delete"
  ON public.contact_review_queue FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());