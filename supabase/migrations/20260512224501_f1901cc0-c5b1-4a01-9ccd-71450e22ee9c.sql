
-- Helper: list members of an org (visible to any member of that org)
CREATE OR REPLACE FUNCTION public.get_org_members(_org_id uuid)
RETURNS TABLE (
  user_id uuid,
  role app_role,
  display_name text,
  email text,
  avatar_url text,
  is_restricted boolean,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, m.role, p.display_name, p.email, p.avatar_url,
         COALESCE(p.is_restricted, false), m.created_at
  FROM public.org_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.org_id = _org_id
    AND public.is_org_member(auth.uid(), _org_id)
  ORDER BY (m.role = 'owner') DESC, COALESCE(p.display_name, p.email) ASC;
$$;

-- Owners can update member roles within their org
DROP POLICY IF EXISTS "Memberships: owner update" ON public.org_memberships;
CREATE POLICY "Memberships: owner update"
  ON public.org_memberships
  FOR UPDATE
  TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner'::app_role))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'owner'::app_role));

-- Owners can remove members (but not themselves) from their org
DROP POLICY IF EXISTS "Memberships: owner delete" ON public.org_memberships;
CREATE POLICY "Memberships: owner delete"
  ON public.org_memberships
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), org_id, 'owner'::app_role)
    AND user_id <> auth.uid()
  );

-- Owners can directly add members to their org
DROP POLICY IF EXISTS "Memberships: owner insert" ON public.org_memberships;
CREATE POLICY "Memberships: owner insert"
  ON public.org_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'owner'::app_role));
