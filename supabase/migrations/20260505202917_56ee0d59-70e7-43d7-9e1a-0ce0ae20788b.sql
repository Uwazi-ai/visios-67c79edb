-- 1. Columns
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_visibility_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_visibility_check CHECK (visibility IN ('team','private'));

CREATE INDEX IF NOT EXISTS contacts_created_by_idx ON public.contacts(created_by);
CREATE INDEX IF NOT EXISTS contacts_visibility_idx ON public.contacts(visibility);

-- 2. Replace RLS policies
DROP POLICY IF EXISTS "Contacts: org read"   ON public.contacts;
DROP POLICY IF EXISTS "Contacts: org write"  ON public.contacts;
DROP POLICY IF EXISTS "Contacts: org update" ON public.contacts;
DROP POLICY IF EXISTS "Contacts: org delete" ON public.contacts;

CREATE POLICY "Contacts: read team or own private"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    (visibility = 'team' AND is_org_member(auth.uid(), org_id))
    OR (visibility = 'private' AND created_by = auth.uid())
  );

CREATE POLICY "Contacts: insert org member"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(auth.uid(), org_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY "Contacts: update team or own private"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    (visibility = 'team' AND is_org_member(auth.uid(), org_id))
    OR (visibility = 'private' AND created_by = auth.uid())
  );

CREATE POLICY "Contacts: delete team or own private"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (
    (visibility = 'team' AND is_org_member(auth.uid(), org_id))
    OR (visibility = 'private' AND created_by = auth.uid())
  );