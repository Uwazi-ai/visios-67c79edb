
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  restricted boolean NOT NULL DEFAULT true,
  invited_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS org_invites_org_email_uq
  ON public.org_invites (org_id, lower(email)) WHERE status = 'pending';

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invites: owner read"
  ON public.org_invites FOR SELECT TO authenticated
  USING (has_org_role(auth.uid(), org_id, 'owner'::app_role));

CREATE POLICY "Invites: self email read"
  ON public.org_invites FOR SELECT TO authenticated
  USING (lower(email) = lower((auth.jwt() ->> 'email')));

CREATE POLICY "Invites: owner insert"
  ON public.org_invites FOR INSERT TO authenticated
  WITH CHECK (has_org_role(auth.uid(), org_id, 'owner'::app_role) AND invited_by = auth.uid());

CREATE POLICY "Invites: owner delete"
  ON public.org_invites FOR DELETE TO authenticated
  USING (has_org_role(auth.uid(), org_id, 'owner'::app_role));

CREATE POLICY "Invites: owner update"
  ON public.org_invites FOR UPDATE TO authenticated
  USING (has_org_role(auth.uid(), org_id, 'owner'::app_role));

-- Replace handle_new_user to auto-accept invites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv record;
  any_restricted boolean := false;
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, google_access_token, google_refresh_token)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'provider_token',
    new.raw_user_meta_data->>'provider_refresh_token'
  )
  ON CONFLICT (id) DO NOTHING;

  FOR inv IN
    SELECT * FROM public.org_invites
    WHERE lower(email) = lower(new.email) AND status = 'pending'
  LOOP
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (new.id, inv.org_id, inv.role)
    ON CONFLICT DO NOTHING;

    UPDATE public.org_invites
      SET status = 'accepted', accepted_at = now()
      WHERE id = inv.id;

    IF inv.restricted THEN
      any_restricted := true;
    END IF;
  END LOOP;

  IF any_restricted THEN
    UPDATE public.profiles SET is_restricted = true WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$;
