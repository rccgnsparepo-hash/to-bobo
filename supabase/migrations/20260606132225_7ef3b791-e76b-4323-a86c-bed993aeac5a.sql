DROP POLICY IF EXISTS "signed in users can read media" ON storage.objects;

CREATE POLICY "users can list own media folder"
ON storage.objects
FOR SELECT
TO authenticated
USING ((bucket_id = 'media') AND ((storage.foldername(name))[1] = (auth.uid())::text));