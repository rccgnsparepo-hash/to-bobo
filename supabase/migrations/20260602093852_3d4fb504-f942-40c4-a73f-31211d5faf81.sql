DROP POLICY IF EXISTS "any authed insert notifications" ON public.notifications;
CREATE POLICY "users insert notifications as actor" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id OR auth.uid() = user_id);