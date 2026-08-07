CREATE TYPE public.event_status AS ENUM ('confirmed','tentative','cancelled');
CREATE TYPE public.event_visibility AS ENUM ('default','public','private','confidential');
CREATE TYPE public.rsvp_status AS ENUM ('needsAction','accepted','declined','tentative');
CREATE TYPE public.event_source AS ENUM ('synced','kova','proposal');
CREATE TYPE public.brief_status AS ENUM ('generating','ready','failed');

CREATE TABLE public.calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  connected_by uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  account_email citext NOT NULL,
  calendar_id text NOT NULL,
  display_name text,
  is_primary boolean NOT NULL DEFAULT true,
  color_override text,
  status public.connection_status NOT NULL DEFAULT 'disconnected',
  sync_token text,
  watch_channel_id text,
  watch_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, calendar_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_accounts TO authenticated;
GRANT ALL ON public.calendar_accounts TO service_role;
ALTER TABLE public.calendar_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read calendar accounts" ON public.calendar_accounts
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org members write calendar accounts" ON public.calendar_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id) AND connected_by = auth.uid());
CREATE POLICY "org members update calendar accounts" ON public.calendar_accounts
  FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members delete calendar accounts" ON public.calendar_accounts
  FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  calendar_account_id uuid NOT NULL REFERENCES public.calendar_accounts(id) ON DELETE CASCADE,
  provider_event_id text NOT NULL,
  ical_uid text,
  recurring_event_id text,
  is_recurring_instance boolean NOT NULL DEFAULT false,
  title text,
  description text,
  location text,
  conference_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  event_timezone text NOT NULL DEFAULT 'UTC',
  status public.event_status NOT NULL DEFAULT 'confirmed',
  visibility public.event_visibility NOT NULL DEFAULT 'default',
  transparency text NOT NULL DEFAULT 'opaque',
  organizer_email citext,
  self_response public.rsvp_status NOT NULL DEFAULT 'needsAction',
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  source public.event_source NOT NULL DEFAULT 'synced',
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  linked_task_ids uuid[] NOT NULL DEFAULT '{}',
  transcript_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_account_id, provider_event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read calendar events" ON public.calendar_events
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org members write calendar events" ON public.calendar_events
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members update calendar events" ON public.calendar_events
  FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members delete calendar events" ON public.calendar_events
  FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE TRIGGER calendar_events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meeting_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  generated_for uuid NOT NULL,
  content text NOT NULL,
  context_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.brief_status NOT NULL DEFAULT 'ready',
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, generated_for)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_briefs TO authenticated;
GRANT ALL ON public.meeting_briefs TO service_role;
ALTER TABLE public.meeting_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own briefs read" ON public.meeting_briefs
  FOR SELECT TO authenticated USING (generated_for = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "own briefs write" ON public.meeting_briefs
  FOR INSERT TO authenticated WITH CHECK (generated_for = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "own briefs update" ON public.meeting_briefs
  FOR UPDATE TO authenticated USING (generated_for = auth.uid()) WITH CHECK (generated_for = auth.uid());
CREATE POLICY "own briefs delete" ON public.meeting_briefs
  FOR DELETE TO authenticated USING (generated_for = auth.uid());

CREATE INDEX idx_events_org_window ON public.calendar_events (org_id, starts_at) WHERE status <> 'cancelled';
CREATE INDEX idx_events_account ON public.calendar_events (calendar_account_id, starts_at);
CREATE INDEX idx_events_busy ON public.calendar_events (starts_at, ends_at) WHERE status = 'confirmed' AND transparency = 'opaque';
CREATE INDEX idx_events_recurring ON public.calendar_events (recurring_event_id) WHERE recurring_event_id IS NOT NULL;
CREATE INDEX idx_briefs_event ON public.meeting_briefs (event_id, generated_for);

CREATE OR REPLACE FUNCTION public.get_schedule_conflicts(p_start timestamptz, p_end timestamptz)
RETURNS TABLE (
  event_a_id uuid, event_b_id uuid,
  org_a_id uuid, org_b_id uuid,
  overlap_start timestamptz, overlap_end timestamptz,
  is_cross_org boolean
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  WITH busy AS (
    SELECT e.id, e.org_id, e.starts_at, e.ends_at, e.ical_uid
      FROM public.calendar_events e
     WHERE e.status = 'confirmed'
       AND e.transparency = 'opaque'
       AND e.all_day = false
       AND e.self_response <> 'declined'
       AND e.starts_at < p_end
       AND e.ends_at > p_start
  )
  SELECT a.id, b.id, a.org_id, b.org_id,
         GREATEST(a.starts_at, b.starts_at),
         LEAST(a.ends_at, b.ends_at),
         a.org_id IS DISTINCT FROM b.org_id
    FROM busy a
    JOIN busy b
      ON a.id < b.id
     AND a.starts_at < b.ends_at
     AND b.starts_at < a.ends_at
     AND (a.ical_uid IS NULL OR b.ical_uid IS NULL OR a.ical_uid <> b.ical_uid)
   ORDER BY 5;
$$;