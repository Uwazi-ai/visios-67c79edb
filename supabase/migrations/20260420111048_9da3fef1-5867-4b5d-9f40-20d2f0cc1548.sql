ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS voice_profile text,
  ADD COLUMN IF NOT EXISTS ai_prefs jsonb NOT NULL DEFAULT jsonb_build_object(
    'model', 'claude-sonnet-4.6',
    'ask_before_send', true,
    'include_thread_context', true
  ),
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT jsonb_build_object(
    'email_digest', true,
    'sms_urgent', true,
    'in_app', true,
    'slack_dm', false,
    'sms_on_urgent_email', true,
    'sms_on_booking', false,
    'daily_brief_time', '07:00'
  );