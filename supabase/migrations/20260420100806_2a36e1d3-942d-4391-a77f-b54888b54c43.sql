ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS scheduling_prefs jsonb NOT NULL DEFAULT jsonb_build_object(
  'focus_start', '09:00',
  'focus_end', '17:00',
  'lunch_start', '12:00',
  'lunch_end', '13:00',
  'max_meeting_hours', 4,
  'buffer_mins', 10,
  'deep_work_start', '09:00',
  'deep_work_end', '11:00'
);