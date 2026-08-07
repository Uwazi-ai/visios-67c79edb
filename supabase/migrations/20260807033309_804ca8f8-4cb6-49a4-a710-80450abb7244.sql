ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS drive_folder_id text NULL;

DO $$ BEGIN
  CREATE TYPE public.drive_ref_source AS ENUM ('picker','pasted','created');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.drive_ref_status AS ENUM ('ok','no_access','not_found','unenriched');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.drive_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  conversation_id uuid NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  chat_message_id uuid NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES auth.users(id),
  file_id text NOT NULL,
  drive_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  icon_url text NULL,
  thumbnail_link text NULL,
  web_view_link text NOT NULL,
  owner_email text NULL,
  externally_owned boolean NOT NULL DEFAULT false,
  file_modified_at timestamptz NULL,
  source public.drive_ref_source NOT NULL,
  status public.drive_ref_status NOT NULL DEFAULT 'ok',
  metadata_fetched_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_references TO authenticated;
GRANT ALL ON public.drive_references TO service_role;
ALTER TABLE public.drive_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drive_refs_participant" ON public.drive_references FOR ALL TO authenticated
  USING (conversation_id IS NOT NULL AND public.can_access_conversation(conversation_id))
  WITH CHECK (conversation_id IS NOT NULL AND public.can_access_conversation(conversation_id) AND shared_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.drive_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_reference_id uuid NOT NULL REFERENCES public.drive_references(id) ON DELETE CASCADE,
  granted_to_email citext NOT NULL,
  granted_to_user_id uuid NULL REFERENCES auth.users(id),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('reader','commenter','writer')),
  google_permission_id text NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL
);

GRANT SELECT ON public.drive_access_grants TO authenticated;
GRANT SELECT, INSERT ON public.drive_access_grants TO service_role;
ALTER TABLE public.drive_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drive_grants_read_org_admin" ON public.drive_access_grants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.drive_references r
     WHERE r.id = drive_reference_id
       AND (public.has_org_role(auth.uid(), r.org_id, 'owner'::app_role)
            OR public.has_org_role(auth.uid(), r.org_id, 'admin'::app_role))
  ));

CREATE INDEX IF NOT EXISTS idx_drive_refs_convo ON public.drive_references (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_refs_file ON public.drive_references (org_id, file_id);
CREATE INDEX IF NOT EXISTS idx_drive_grants_ref ON public.drive_access_grants (drive_reference_id) WHERE revoked_at IS NULL;