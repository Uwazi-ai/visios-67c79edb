
-- Remove anon-readable policy that exposed user_id/org_id on event_types
DROP POLICY IF EXISTS "EventTypes: public read active" ON public.event_types;

-- Restrict visi_migration_tasks reads to super admins
DROP POLICY IF EXISTS vmt_read_auth ON public.visi_migration_tasks;
CREATE POLICY vmt_read_admin ON public.visi_migration_tasks
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Explicit UPDATE policy for chat-attachments (uploader only)
DROP POLICY IF EXISTS "Chat attachments: uploader can update own files" ON storage.objects;
CREATE POLICY "Chat attachments: uploader can update own files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[3] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[3] = (auth.uid())::text);
