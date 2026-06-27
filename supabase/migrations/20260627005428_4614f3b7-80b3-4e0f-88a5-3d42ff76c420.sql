
-- 1. ORGS
REVOKE SELECT (priorities, success_definition, success_metric, stage_labels,
               drive_folder_id, pipeline_stages, relationship_label,
               shared_drive_id, shared_drive_name, shared_drive_connected_at,
               description, metadata)
  ON public.orgs FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_org_full(_org_id uuid)
RETURNS SETOF public.orgs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.orgs
   WHERE id = _org_id
     AND (public.has_org_role(auth.uid(), _org_id, 'owner'::app_role)
          OR public.is_super_admin(auth.uid()));
$$;
GRANT EXECUTE ON FUNCTION public.get_org_full(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_owned_orgs_full()
RETURNS SETOF public.orgs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.* FROM public.orgs o
   WHERE public.has_org_role(auth.uid(), o.id, 'owner'::app_role)
      OR public.is_super_admin(auth.uid())
   ORDER BY o.display_order NULLS LAST, o.name;
$$;
GRANT EXECUTE ON FUNCTION public.list_owned_orgs_full() TO authenticated;

-- 2. PROFILES
REVOKE SELECT (google_access_token, google_refresh_token, google_granted_scopes,
               phone, notification_prefs, scheduling_prefs, voice_profile,
               ai_prefs, preferences, is_restricted)
  ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile_private()
RETURNS TABLE (
  id uuid, email text, display_name text,
  google_access_token text, google_refresh_token text, google_granted_scopes text,
  phone text, notification_prefs jsonb, scheduling_prefs jsonb,
  voice_profile text, ai_prefs jsonb, preferences jsonb, is_restricted boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.email, p.display_name,
         p.google_access_token, p.google_refresh_token, p.google_granted_scopes,
         p.phone, p.notification_prefs, p.scheduling_prefs, p.voice_profile,
         p.ai_prefs, p.preferences, COALESCE(p.is_restricted, false)
    FROM public.profiles p
   WHERE p.id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile_private() TO authenticated;

-- 3. CONTACT_BOOKING_LINKS
DROP POLICY IF EXISTS "cbl: host can read own" ON public.contact_booking_links;
DROP POLICY IF EXISTS "cbl: host can insert"   ON public.contact_booking_links;
DROP POLICY IF EXISTS "cbl: host can update"   ON public.contact_booking_links;
DROP POLICY IF EXISTS "cbl: host can delete"   ON public.contact_booking_links;

CREATE POLICY "cbl: host can read own"
  ON public.contact_booking_links FOR SELECT TO authenticated
  USING (host_user_id = auth.uid());
CREATE POLICY "cbl: host can insert"
  ON public.contact_booking_links FOR INSERT TO authenticated
  WITH CHECK (host_user_id = auth.uid());
CREATE POLICY "cbl: host can update"
  ON public.contact_booking_links FOR UPDATE TO authenticated
  USING (host_user_id = auth.uid()) WITH CHECK (host_user_id = auth.uid());
CREATE POLICY "cbl: host can delete"
  ON public.contact_booking_links FOR DELETE TO authenticated
  USING (host_user_id = auth.uid());

-- 4. KB STORAGE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname='kb: org members can read shared docs'
  ) THEN
    CREATE POLICY "kb: org members can read shared docs"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'knowledge-base'
        AND EXISTS (
          SELECT 1
            FROM public.kb_documents d
            JOIN public.org_memberships m_self ON m_self.org_id = d.org_id
           WHERE m_self.user_id = auth.uid()
             AND d.org_id IS NOT NULL
             AND d.file_path = name
        )
      );
  END IF;
END $$;
