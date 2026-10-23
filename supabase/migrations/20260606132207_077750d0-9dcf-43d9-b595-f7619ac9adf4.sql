DROP POLICY IF EXISTS "media readable" ON storage.objects;
DROP POLICY IF EXISTS "media read by authenticated" ON storage.objects;

CREATE POLICY "signed in users can read media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'media');