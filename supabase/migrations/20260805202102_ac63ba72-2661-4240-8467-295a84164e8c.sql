ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS org_count text;
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_key ON public.waitlist (lower(email));