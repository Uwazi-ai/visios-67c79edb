DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;

-- Allow public read of individual avatar objects but block listing (no wildcard ability)
CREATE POLICY "Avatars: public read object"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] IS NOT NULL
);