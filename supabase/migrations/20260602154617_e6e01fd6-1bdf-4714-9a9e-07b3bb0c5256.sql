-- Allow org members to see each other's memberships within shared orgs
DROP POLICY IF EXISTS "Memberships: self read" ON public.org_memberships;

CREATE POLICY "Memberships: org members read"
ON public.org_memberships
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_member(auth.uid(), org_id)
);

-- Allow signed-in users to read basic profile info for people who share an org with them.
-- (Existing self-read and public-username policies remain in place.)
CREATE POLICY "Profiles: shared org read"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.org_memberships m_self
    JOIN public.org_memberships m_other
      ON m_other.org_id = m_self.org_id
    WHERE m_self.user_id = auth.uid()
      AND m_other.user_id = profiles.id
  )
);