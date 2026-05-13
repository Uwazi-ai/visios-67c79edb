
-- 1. Extend events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'org' CHECK (visibility IN ('personal','org','all_orgs'));
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS color text;

-- Backfill created_by from user_id where possible
UPDATE public.events SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL;

-- 2. event_attendees
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined','tentative')),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON public.event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON public.event_attendees(event_id);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- 3. calendar_preferences
CREATE TABLE IF NOT EXISTS public.calendar_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  visible_member_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_preferences ENABLE ROW LEVEL SECURITY;

-- 4. RLS — events: extend visibility (existing "Events: org read" stays for org-visible)
DROP POLICY IF EXISTS "Events: personal read" ON public.events;
CREATE POLICY "Events: personal read" ON public.events FOR SELECT TO authenticated
  USING (visibility = 'personal' AND created_by = auth.uid());

DROP POLICY IF EXISTS "Events: all_orgs read" ON public.events;
CREATE POLICY "Events: all_orgs read" ON public.events FOR SELECT TO authenticated
  USING (visibility = 'all_orgs');

DROP POLICY IF EXISTS "Events: attendee read" ON public.events;
CREATE POLICY "Events: attendee read" ON public.events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_attendees a WHERE a.event_id = events.id AND a.user_id = auth.uid()));

-- Allow creator to update/delete their own personal events even without org
DROP POLICY IF EXISTS "Events: creator update" ON public.events;
CREATE POLICY "Events: creator update" ON public.events FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Events: creator delete" ON public.events;
CREATE POLICY "Events: creator delete" ON public.events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Allow personal-event insert (no org)
DROP POLICY IF EXISTS "Events: personal insert" ON public.events;
CREATE POLICY "Events: personal insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (visibility = 'personal' AND created_by = auth.uid() AND org_id IS NULL);

-- 5. RLS — event_attendees
DROP POLICY IF EXISTS "EventAttendees: read if can see event" ON public.event_attendees;
CREATE POLICY "EventAttendees: read if can see event" ON public.event_attendees FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_attendees.event_id
        AND (
          (e.visibility = 'personal' AND e.created_by = auth.uid())
          OR (e.visibility = 'all_orgs')
          OR (e.org_id IS NOT NULL AND public.is_org_member(auth.uid(), e.org_id))
          OR e.created_by = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "EventAttendees: organizer insert" ON public.event_attendees;
CREATE POLICY "EventAttendees: organizer insert" ON public.event_attendees FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_attendees.event_id AND e.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "EventAttendees: organizer delete" ON public.event_attendees;
CREATE POLICY "EventAttendees: organizer delete" ON public.event_attendees FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_attendees.event_id AND e.created_by = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "EventAttendees: self rsvp" ON public.event_attendees;
CREATE POLICY "EventAttendees: self rsvp" ON public.event_attendees FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. RLS — calendar_preferences
DROP POLICY IF EXISTS "CalPrefs: self all" ON public.calendar_preferences;
CREATE POLICY "CalPrefs: self all" ON public.calendar_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Realtime for attendees
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_attendees;
