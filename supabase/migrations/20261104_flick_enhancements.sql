-- ==============================================================================
-- FLICK PLATFORM ENHANCEMENTS MIGRATION
-- Includes:
-- 1. Privacy Settings & Close Friends
-- 2. Bookmarks & Bookmark Folders (Private to user)
-- 3. Moderation Reports, Appeals, User Blocks, User Mutes, Muted Keywords
-- 4. Account Deletion Requests (14-Day Grace Period)
-- 5. Full RLS Policies & Search Optimization
-- ==============================================================================

-- 1. PRIVACY SETTINGS
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT false,
  dm_permission TEXT DEFAULT 'everyone' CHECK (dm_permission IN ('everyone', 'following', 'none')),
  content_visibility TEXT DEFAULT 'public' CHECK (content_visibility IN ('public', 'followers', 'close_friends')),
  read_receipts BOOLEAN DEFAULT true,
  typing_indicators BOOLEAN DEFAULT true,
  appear_in_search BOOLEAN DEFAULT true,
  disappearing_chat_default TEXT DEFAULT 'off' CHECK (disappearing_chat_default IN ('off', '24h', '7d', '30d')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own privacy settings"
  ON public.privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert or update their own privacy settings"
  ON public.privacy_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public can check if someone's profile is private or appears in search
CREATE POLICY "Public can view basic privacy flags"
  ON public.privacy_settings FOR SELECT
  USING (true);


-- 2. CLOSE FRIENDS
CREATE TABLE IF NOT EXISTS public.close_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own close friends list"
  ON public.close_friends FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 3. USER BLOCKS (Bidirectional enforcement)
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocks they initiated"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create and delete blocks they initiate"
  ON public.user_blocks FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);


-- 4. USER MUTES (Muter does not see muted content)
CREATE TABLE IF NOT EXISTS public.user_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, muted_user_id)
);

ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their mutes"
  ON public.user_mutes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 5. MUTED KEYWORDS
CREATE TABLE IF NOT EXISTS public.muted_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, keyword)
);

ALTER TABLE public.muted_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their muted keywords"
  ON public.muted_keywords FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 6. MODERATION REPORTS & APPEALS
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'profile', 'story', 'message')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'self_harm', 'nudity', 'impersonation', 'other')),
  note TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_action TEXT CHECK (resolution_action IN ('dismissed', 'content_removed', 'user_warned', 'user_suspended', null)),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can view reports they created"
  ON public.moderation_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Authenticated users can submit reports"
  ON public.moderation_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  report_id UUID REFERENCES public.moderation_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  explanation TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (report_id, user_id)
);

ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their appeals"
  ON public.moderation_appeals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 7. BOOKMARK FOLDERS & BOOKMARKS (Private to User)
CREATE TABLE IF NOT EXISTS public.bookmark_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#b8ff00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.bookmark_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own folders"
  ON public.bookmark_folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.bookmark_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bookmarks are strictly private to the user"
  ON public.bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 8. ACCOUNT DELETION REQUESTS (14-Day Grace Period)
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_column(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_deletion_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed'))
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and cancel their deletion requests"
  ON public.account_deletion_requests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 9. FULL-TEXT SEARCH & TRIGRAM INDEXES
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON public.posts USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_handle_trgm ON public.profiles USING gin (handle gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm ON public.profiles USING gin (display_name gin_trgm_ops);
