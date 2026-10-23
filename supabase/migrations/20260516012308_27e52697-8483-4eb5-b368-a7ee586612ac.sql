
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'text' CHECK (media_type IN ('text','image','video','audio'));

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video'));

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments readable" ON public.comments;
CREATE POLICY "comments readable" ON public.comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users add comments" ON public.comments;
CREATE POLICY "users add comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "users delete own comments" ON public.comments;
CREATE POLICY "users delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS public.reshares (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.reshares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reshares readable" ON public.reshares;
CREATE POLICY "reshares readable" ON public.reshares FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users reshare" ON public.reshares;
CREATE POLICY "users reshare" ON public.reshares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users unreshare" ON public.reshares;
CREATE POLICY "users unreshare" ON public.reshares FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.story_tags (
  story_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (story_id, user_id)
);
ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story tags readable" ON public.story_tags;
CREATE POLICY "story tags readable" ON public.story_tags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "story owners tag" ON public.story_tags;
CREATE POLICY "story owners tag" ON public.story_tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.chat_settings (
  owner_id uuid NOT NULL,
  peer_id uuid NOT NULL,
  bg_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, peer_id)
);
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat settings own read" ON public.chat_settings;
CREATE POLICY "chat settings own read" ON public.chat_settings FOR SELECT TO authenticated USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "chat settings own write" ON public.chat_settings;
CREATE POLICY "chat settings own write" ON public.chat_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "chat settings own update" ON public.chat_settings;
CREATE POLICY "chat settings own update" ON public.chat_settings FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  for_date date NOT NULL UNIQUE,
  title text NOT NULL,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges readable" ON public.daily_challenges;
CREATE POLICY "challenges readable" ON public.daily_challenges FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "submissions readable" ON public.challenge_submissions;
CREATE POLICY "submissions readable" ON public.challenge_submissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users submit" ON public.challenge_submissions;
CREATE POLICY "users submit" ON public.challenge_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.comics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  cover_url text NOT NULL,
  description text,
  pages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comics readable" ON public.comics;
CREATE POLICY "comics readable" ON public.comics FOR SELECT TO authenticated USING (true);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reshares;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.daily_challenges (for_date, title, prompt)
VALUES (CURRENT_DATE, 'Sun seekers', 'Flick the most beautiful light you see today — a window, a candle, anything glowing.')
ON CONFLICT (for_date) DO NOTHING;
