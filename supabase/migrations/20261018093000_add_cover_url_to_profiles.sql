-- Add cover_url column to profiles so cover uploads can be persisted
-- Generated: 2026-10-18

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text;

-- Note: RLS policies on profiles already permit authenticated users to update their own row
-- (policy: "users update own profile" USING (auth.uid() = id)), so no additional policy changes are required.
