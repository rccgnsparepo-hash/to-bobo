CREATE POLICY "dm media participants read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dm-media' AND auth.uid()::text = ANY(string_to_array((storage.foldername(name))[1], '__')));

CREATE POLICY "dm media participants insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dm-media' AND auth.uid()::text = ANY(string_to_array((storage.foldername(name))[1], '__')) AND owner = auth.uid());

CREATE POLICY "dm media owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dm-media' AND owner = auth.uid());