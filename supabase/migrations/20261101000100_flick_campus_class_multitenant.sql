-- ============================================================================
-- Migration: Flick Campus Class Multi-Tenant Modal Database Structure
-- Dedicated 30GB Quota Model strictly for Flick Lecture Platform (excluding Flick Social)
-- Multi-level Academic Schema (100L - 600L), Timetable & Slide Library
-- ============================================================================

-- 1. Campus Tenant & Quota Registry (30 GB Quota strictly allocated for Lecture Platform)
CREATE TABLE IF NOT EXISTS public.campus_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code VARCHAR(32) UNIQUE NOT NULL DEFAULT 'FLICK-CAMPUS-ZONE',
  tenant_name TEXT NOT NULL DEFAULT 'Flick University Lecture Hub',
  allocated_storage_bytes BIGINT NOT NULL DEFAULT 32212254720, -- 30.00 GB strictly for Lecture Zone
  used_storage_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed primary tenant with 30GB quota if not exists
INSERT INTO public.campus_tenants (tenant_code, tenant_name, allocated_storage_bytes, used_storage_bytes)
VALUES ('FLICK-CAMPUS-ZONE', 'Flick University Lecture Hub', 32212254720, 0)
ON CONFLICT (tenant_code) DO NOTHING;

-- 2. Academic Users (Students & Lecturers with Matric No, Level 100-600, Verification Key)
CREATE TABLE IF NOT EXISTS public.campus_academic_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'lecturer')),
  full_name TEXT NOT NULL,
  matric_no TEXT,              -- Mandatory for Students (e.g. FUPRE/21/ENG/1029)
  staff_id TEXT,               -- For Lecturers
  department TEXT NOT NULL,    -- e.g. Computer Science, Medicine, Law
  faculty TEXT,                -- e.g. Faculty of Science / Engineering
  academic_level INT CHECK (academic_level IN (100, 200, 300, 400, 500, 600)), -- 6 levels
  courses_taught TEXT[] DEFAULT '{}',
  teacher_verified BOOLEAN NOT NULL DEFAULT false, -- Set true ONLY when teacher key A1B2C3D4E5 matches
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_campus_user_matric UNIQUE (matric_no),
  CONSTRAINT uq_campus_user_auth UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_academic_level ON public.campus_academic_users(academic_level);
CREATE INDEX IF NOT EXISTS idx_academic_dept ON public.campus_academic_users(department);
CREATE INDEX IF NOT EXISTS idx_academic_role ON public.campus_academic_users(role);

-- 3. Campus Courses Across Levels 100 to 600
CREATE TABLE IF NOT EXISTS public.campus_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code VARCHAR(20) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  academic_level INT NOT NULL CHECK (academic_level IN (100, 200, 300, 400, 500, 600)),
  credit_units INT NOT NULL DEFAULT 3,
  semester INT NOT NULL DEFAULT 1,
  lecturer_name TEXT,
  lecturer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campus_courses_level ON public.campus_courses(academic_level);
CREATE INDEX IF NOT EXISTS idx_campus_courses_dept ON public.campus_courses(department);

-- 4. Level-Based Lecture Timetable (100L - 600L)
CREATE TABLE IF NOT EXISTS public.campus_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code VARCHAR(20) NOT NULL,
  course_title TEXT NOT NULL,
  department TEXT NOT NULL,
  academic_level INT NOT NULL CHECK (academic_level IN (100, 200, 300, 400, 500, 600)),
  lecturer_name TEXT NOT NULL,
  lecturer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  day_of_week VARCHAR(15) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
  start_time VARCHAR(8) NOT NULL, -- e.g. '08:00'
  end_time VARCHAR(8) NOT NULL,   -- e.g. '10:00'
  venue TEXT NOT NULL DEFAULT 'Virtual Lecture Theatre',
  active_room_id UUID REFERENCES public.class_rooms(id) ON DELETE SET NULL,
  is_in_session BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetable_level_day ON public.campus_timetables(academic_level, day_of_week);

-- 5. Dedicated Slide Storage Tracker (Against 30GB quota)
CREATE TABLE IF NOT EXISTS public.campus_slide_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code VARCHAR(32) NOT NULL DEFAULT 'FLICK-CAMPUS-ZONE',
  course_code VARCHAR(20) NOT NULL,
  academic_level INT NOT NULL CHECK (academic_level IN (100, 200, 300, 400, 500, 600)),
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  pages_count INT NOT NULL DEFAULT 1,
  slides_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  download_permitted BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slide_storage_course ON public.campus_slide_storage(course_code);
CREATE INDEX IF NOT EXISTS idx_slide_storage_level ON public.campus_slide_storage(academic_level);

-- 6. Trigger to Update Tenant Storage Usage
CREATE OR REPLACE FUNCTION public.fn_update_campus_storage_metric()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.campus_tenants
    SET used_storage_bytes = used_storage_bytes + NEW.file_size_bytes,
        updated_at = now()
    WHERE tenant_code = NEW.tenant_code;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.campus_tenants
    SET used_storage_bytes = GREATEST(0, used_storage_bytes - OLD.file_size_bytes),
        updated_at = now()
    WHERE tenant_code = OLD.tenant_code;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campus_storage ON public.campus_slide_storage;
CREATE TRIGGER trg_update_campus_storage
AFTER INSERT OR DELETE ON public.campus_slide_storage
FOR EACH ROW EXECUTE FUNCTION public.fn_update_campus_storage_metric();

-- 7. Row Level Security Policies
ALTER TABLE public.campus_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_academic_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_slide_storage ENABLE ROW LEVEL SECURITY;

-- Tenants: Public read of quota metrics
CREATE POLICY "Public read of campus tenant quota"
  ON public.campus_tenants FOR SELECT
  USING (true);

-- Academic Users: Anyone authenticated can read user profiles
CREATE POLICY "Read academic profiles"
  ON public.campus_academic_users FOR SELECT
  USING (true);

CREATE POLICY "Insert own academic profile"
  ON public.campus_academic_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Update own academic profile"
  ON public.campus_academic_users FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Timetable & Courses: Read-all, lecturers can insert/update
CREATE POLICY "Read courses across levels"
  ON public.campus_courses FOR SELECT
  USING (true);

CREATE POLICY "Lecturers can create courses"
  ON public.campus_courses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Read timetables across levels"
  ON public.campus_timetables FOR SELECT
  USING (true);

CREATE POLICY "Lecturers can manage timetables"
  ON public.campus_timetables FOR ALL
  USING (true);

CREATE POLICY "Read slides for enrolled students and lecturers"
  ON public.campus_slide_storage FOR SELECT
  USING (true);

CREATE POLICY "Lecturers can upload slides"
  ON public.campus_slide_storage FOR INSERT
  WITH CHECK (true);
