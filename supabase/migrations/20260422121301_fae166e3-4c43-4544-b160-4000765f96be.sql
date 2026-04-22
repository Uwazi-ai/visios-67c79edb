-- Create private bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Files are stored under {org_id}/{channel_id}/{user_id}/{filename}
-- RLS: only org members can read/write files in their org's folder, and only the uploader can write under their user folder.

CREATE POLICY "Chat attachments: org members can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Chat attachments: org members can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[3] = auth.uid()::text
);

CREATE POLICY "Chat attachments: uploader can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[3] = auth.uid()::text
);