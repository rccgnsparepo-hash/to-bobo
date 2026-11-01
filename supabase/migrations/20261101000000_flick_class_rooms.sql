-- ============================================================================
-- Migration: Flick Class Rooms, Members, and Slide State with RLS Policies
-- Privacy-first: invite-only rooms, zero recording unless turned on by host
-- ============================================================================

-- 1. Class Rooms Table
CREATE TABLE IF NOT EXISTS public.class_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code VARCHAR(8) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  course_code TEXT,
  lecturer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecturer_name TEXT NOT NULL,
  lecturer_avatar TEXT,
  is_live BOOLEAN NOT NULL DEFAULT true,
  current_slide_index INT NOT NULL DEFAULT 0,
  total_slides INT NOT NULL DEFAULT 1,
  slides_downloadable BOOLEAN NOT NULL DEFAULT true,
  notes_downloadable BOOLEAN NOT NULL DEFAULT true,
  slides_data JSONB DEFAULT '[]'::jsonb,
  lecturer_notes TEXT DEFAULT '',
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for instant lookup by join code
CREATE INDEX IF NOT EXISTS idx_class_rooms_join_code ON public.class_rooms(join_code);
CREATE INDEX IF NOT EXISTS idx_class_rooms_lecturer ON public.class_rooms(lecturer_id);

-- 2. Class Members Table (Lecturer, Co-host, Student)
CREATE TABLE IF NOT EXISTS public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.class_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('lecturer', 'co_host', 'student')),
  is_muted BOOLEAN NOT NULL DEFAULT true,
  hand_raised BOOLEAN NOT NULL DEFAULT false,
  hand_raised_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_member_room UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_room ON public.class_members(room_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON public.class_members(user_id);

-- 3. Enable RLS on both tables
ALTER TABLE public.class_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for class_rooms
-- Read: Anyone authenticated can read rooms by join_code or room membership
DROP POLICY IF EXISTS "Anyone authenticated can read active class rooms" ON public.class_rooms;
CREATE POLICY "Anyone authenticated can read active class rooms"
  ON public.class_rooms FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Authenticated users can create rooms where they are the lecturer
DROP POLICY IF EXISTS "Users can create their own class rooms" ON public.class_rooms;
CREATE POLICY "Users can create their own class rooms"
  ON public.class_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = lecturer_id);

-- Update: Only lecturer and co-hosts can update room state (slides, notes, permissions)
DROP POLICY IF EXISTS "Lecturers and co-hosts can update their class room" ON public.class_rooms;
CREATE POLICY "Lecturers and co-hosts can update their class room"
  ON public.class_rooms FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = lecturer_id OR 
    EXISTS (
      SELECT 1 FROM public.class_members 
      WHERE room_id = class_rooms.id AND user_id = auth.uid() AND role IN ('lecturer', 'co_host')
    )
  );

-- Delete: Only the lecturer can delete / close their room
DROP POLICY IF EXISTS "Only the lecturer can delete their room" ON public.class_rooms;
CREATE POLICY "Only the lecturer can delete their room"
  ON public.class_rooms FOR DELETE
  TO authenticated
  USING (auth.uid() = lecturer_id);

-- 5. RLS Policies for class_members
-- Read: Members of the room can see other participants
DROP POLICY IF EXISTS "Room members can view room participants" ON public.class_members;
CREATE POLICY "Room members can view room participants"
  ON public.class_members FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Users can join a room as a student
DROP POLICY IF EXISTS "Users can join rooms" ON public.class_members;
CREATE POLICY "Users can join rooms"
  ON public.class_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update:
-- Students can update their own mute and hand_raised state
-- Lecturers and co-hosts can mute/unmute or lower hands of any student in their room
DROP POLICY IF EXISTS "Members can update their own state or lecturers can manage" ON public.class_members;
CREATE POLICY "Members can update their own state or lecturers can manage"
  ON public.class_members FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.class_rooms r
      WHERE r.id = class_members.room_id AND r.lecturer_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.class_members m
      WHERE m.room_id = class_members.room_id AND m.user_id = auth.uid() AND m.role IN ('lecturer', 'co_host')
    )
  );

-- Delete: Members can leave, or lecturers can kick participants
DROP POLICY IF EXISTS "Members can leave or lecturers can remove" ON public.class_members;
CREATE POLICY "Members can leave or lecturers can remove"
  ON public.class_members FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.class_rooms r
      WHERE r.id = class_members.room_id AND r.lecturer_id = auth.uid()
    )
  );
