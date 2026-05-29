ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS shared_drive_id TEXT;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS shared_drive_name TEXT;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS shared_drive_connected_at TIMESTAMPTZ;