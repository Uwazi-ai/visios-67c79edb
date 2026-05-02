
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS engagement_stage text NOT NULL DEFAULT 'prospect';

CREATE TABLE IF NOT EXISTS public.contact_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.orgs(id),
  type text NOT NULL CHECK (type IN ('email','meeting','call','note','task')),
  title text,
  summary text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_interactions_contact_idx
  ON public.contact_interactions(contact_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS contact_interactions_dedupe_idx
  ON public.contact_interactions(contact_id, source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ContactInteractions: org read"
  ON public.contact_interactions FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "ContactInteractions: org write"
  ON public.contact_interactions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "ContactInteractions: org update"
  ON public.contact_interactions FOR UPDATE
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "ContactInteractions: org delete"
  ON public.contact_interactions FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
