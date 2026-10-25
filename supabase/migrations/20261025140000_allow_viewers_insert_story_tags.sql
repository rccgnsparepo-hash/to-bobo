-- Allow authenticated viewers to record their own story views in story_tags
DROP POLICY IF EXISTS "story owners tag" ON public.story_tags;
DROP POLICY IF EXISTS "story viewers insert tag" ON public.story_tags;
CREATE POLICY "story viewers insert tag" ON public.story_tags FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
);
