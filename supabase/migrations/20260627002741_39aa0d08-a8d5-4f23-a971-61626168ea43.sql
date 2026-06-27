
ALTER TABLE public.visi_settings ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Vision';
ALTER TABLE public.visi_settings ADD COLUMN IF NOT EXISTS persona_description TEXT;
ALTER TABLE public.visi_settings ADD COLUMN IF NOT EXISTS brief_time TIME NOT NULL DEFAULT '08:00';
ALTER TABLE public.visi_settings ADD COLUMN IF NOT EXISTS brief_to_channel BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.visi_settings ADD COLUMN IF NOT EXISTS brief_to_inbox BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.visi_settings ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE public.visi_settings ADD CONSTRAINT visi_settings_tone_check CHECK (tone IN ('professional','direct','friendly','executive'));

ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Chicago';
