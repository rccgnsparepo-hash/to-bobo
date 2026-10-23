
ALTER TABLE public.chat_settings ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'system';
ALTER TABLE public.chat_settings ADD COLUMN IF NOT EXISTS disappearing_seconds integer;

ALTER TABLE public.messages ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN expires_at DROP DEFAULT;

DROP POLICY IF EXISTS "messages readable by participants if not expired" ON public.messages;
CREATE POLICY "messages readable by participants"
ON public.messages FOR SELECT TO authenticated
USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)) AND (expires_at IS NULL OR expires_at > now()));

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks own read" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "blocks own write" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks own delete" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_user_id uuid,
  target_kind text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports own read" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "reports own insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS public.muted_chats (
  owner_id uuid NOT NULL,
  peer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, peer_id)
);
GRANT SELECT, INSERT, DELETE ON public.muted_chats TO authenticated;
GRANT ALL ON public.muted_chats TO service_role;
ALTER TABLE public.muted_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mute own read" ON public.muted_chats FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "mute own write" ON public.muted_chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "mute own delete" ON public.muted_chats FOR DELETE TO authenticated USING (auth.uid() = owner_id);

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;
