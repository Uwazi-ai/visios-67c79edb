GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_attendee(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_event(uuid, uuid) TO authenticated;