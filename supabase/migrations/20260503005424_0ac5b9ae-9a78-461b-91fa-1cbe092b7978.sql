
-- Add new columns
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS org_type TEXT DEFAULT 'startup';
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS success_metric TEXT;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS pipeline_stages JSONB NOT NULL DEFAULT '["Prospect","Intro","Active","Champion"]'::jsonb;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS relationship_label TEXT DEFAULT 'Partners';
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS created_by UUID;

-- Backfill short_name and display_order
UPDATE public.orgs SET short_name = COALESCE(short_name, UPPER(LEFT(split_part(name, ' ', 1), 10))) WHERE short_name IS NULL;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS rn FROM public.orgs
)
UPDATE public.orgs o SET display_order = r.rn FROM ranked r WHERE o.id = r.id AND o.display_order = 0;

-- Unique slug index
CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug_idx ON public.orgs(slug);

-- RLS: allow authenticated users to create orgs
DROP POLICY IF EXISTS "Orgs: authenticated insert" ON public.orgs;
CREATE POLICY "Orgs: authenticated insert"
ON public.orgs
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- RLS: allow creator to update their org (in addition to owner policy)
DROP POLICY IF EXISTS "Orgs: creator update" ON public.orgs;
CREATE POLICY "Orgs: creator update"
ON public.orgs
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_org_role(auth.uid(), id, 'owner'::app_role))
WITH CHECK (created_by = auth.uid() OR has_org_role(auth.uid(), id, 'owner'::app_role));

-- Trigger: auto-create owner membership on org insert
CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (NEW.created_by, NEW.id, 'owner'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_org_created ON public.orgs;
CREATE TRIGGER on_org_created
AFTER INSERT ON public.orgs
FOR EACH ROW EXECUTE FUNCTION public.handle_new_org();

-- Enable realtime
ALTER TABLE public.orgs REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orgs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orgs';
  END IF;
END $$;
