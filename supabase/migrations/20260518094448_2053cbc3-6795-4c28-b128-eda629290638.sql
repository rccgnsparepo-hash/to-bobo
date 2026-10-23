-- Reactions table (mood reactions alongside likes)
CREATE TABLE public.reactions (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions readable" ON public.reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "users react" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update reaction" ON public.reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users unreact" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Avatar upload policies on existing public 'media' bucket (users own folder)
CREATE POLICY "avatar uploads own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar updates own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media readable" ON storage.objects FOR SELECT TO public USING (bucket_id = 'media');