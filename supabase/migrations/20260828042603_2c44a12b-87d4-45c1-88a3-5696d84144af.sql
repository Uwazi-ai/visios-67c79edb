CREATE OR REPLACE FUNCTION public.is_event_attendee(_event_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE event_id = _event_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_see_event(_event_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id AND (
      (e.visibility = 'personal' AND e.created_by = _user_id)
      OR e.visibility = 'all_orgs'
      OR (e.org_id IS NOT NULL AND public.is_org_member(_user_id, e.org_id))
      OR e.created_by = _user_id
    )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_event_attendee(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_see_event(uuid, uuid) FROM anon, authenticated;

DROP POLICY IF EXISTS "Events: attendee read" ON public.events;
CREATE POLICY "Events: attendee read" ON public.events
  FOR SELECT TO authenticated
  USING (public.is_event_attendee(id, auth.uid()));

DROP POLICY IF EXISTS "EventAttendees: read if can see event" ON public.event_attendees;
CREATE POLICY "EventAttendees: read if can see event" ON public.event_attendees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_see_event(event_id, auth.uid()));