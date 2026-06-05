
CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version bigint NOT NULL,
  notes text,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX app_versions_version_key ON public.app_versions(version);

GRANT SELECT, INSERT ON public.app_versions TO authenticated;
GRANT ALL ON public.app_versions TO service_role;

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'myke@uwazi.ai'
  )
$$;

CREATE POLICY "Anyone authenticated can view app versions"
  ON public.app_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admin can push new versions"
  ON public.app_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) AND released_by = auth.uid());

-- Seed an initial version row so listeners have something to compare against
INSERT INTO public.app_versions (version, notes)
VALUES (extract(epoch from now())::bigint, 'initial');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_versions;
