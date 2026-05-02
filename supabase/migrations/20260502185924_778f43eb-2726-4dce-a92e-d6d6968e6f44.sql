-- Add metadata jsonb to orgs (domains live here under metadata.domains)
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allow org owners to update their org row (so they can edit domains)
DROP POLICY IF EXISTS "Orgs: owner update" ON public.orgs;
CREATE POLICY "Orgs: owner update"
ON public.orgs
FOR UPDATE
TO authenticated
USING (public.has_org_role(auth.uid(), id, 'owner'::app_role))
WITH CHECK (public.has_org_role(auth.uid(), id, 'owner'::app_role));
