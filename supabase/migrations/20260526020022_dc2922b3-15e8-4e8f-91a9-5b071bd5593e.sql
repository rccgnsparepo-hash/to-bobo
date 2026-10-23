
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.stories REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.likes REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='posts';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='stories';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.stories; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='comments';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='likes';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.likes; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved readable" ON public.saved_posts;
CREATE POLICY "saved readable" ON public.saved_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved insert" ON public.saved_posts;
CREATE POLICY "saved insert" ON public.saved_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved delete" ON public.saved_posts;
CREATE POLICY "saved delete" ON public.saved_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
