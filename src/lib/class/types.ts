/**
 * Flick Class Types & Data Models
 * High-performance, privacy-first campus lecture zone
 * Multi-tenant modal architecture with dedicated 30GB Quota model
 * 3 Colleges: CBAS, CHMS, CHAS across 6 levels: 100L to 600L
 */

export type ClassRole = "lecturer" | "co_host" | "student";

export type AcademicLevel = 100 | 200 | 300 | 400 | 500 | 600;

export type CampusCollege = "CBAS" | "CHMS" | "CHAS";

export const COLLEGE_DEFINITIONS: Record<CampusCollege, { name: string; description: string; departments: string[] }> = {
  CBAS: {
    name: "College of Basic & Applied Sciences",
    description: "Computing, Physical Sciences, Chemical Sciences, Biological & Mathematical Sciences",
    departments: [
      "Computer Science",
      "Software Engineering",
      "Cyber Security",
      "Information Technology",
      "Mathematics",
      "Physics & Electronics",
      "Pure & Applied Chemistry",
      "Biochemistry",
      "Microbiology",
      "Biotechnology",
      "Geology",
      "Statistics",
    ],
  },
  CHMS: {
    name: "College of Humanities, Management & Social Sciences",
    description: "Economics, Management, Accounting, Communication & Humanities",
    departments: [
      "Economics",
      "Accounting",
      "Business Administration",
      "Mass Communication",
      "Finance & Banking",
      "Political Science",
      "International Relations",
      "Sociology",
      "Public Administration",
      "English & Literary Studies",
      "Marketing",
    ],
  },
  CHAS: {
    name: "College of Health & Allied Sciences",
    description: "Medicine, Pharmacy, Nursing, Medical Laboratory & Public Health",
    departments: [
      "Medicine & Surgery",
      "Pharmacy",
      "Nursing Science",
      "Medical Laboratory Science",
      "Public Health",
      "Human Anatomy",
      "Human Physiology",
      "Physiotherapy",
      "Radiography",
      "Dentistry",
    ],
  },
};

export const TEACHER_VERIFICATION_KEY = "A1B2C3D4E5";

export const CAMPUS_STORAGE_TOTAL_BYTES = 30 * 1024 * 1024 * 1024; // Exactly 30.00 GB

export interface AcademicProfile {
  id: string;
  userId?: string;
  role: "student" | "lecturer";
  fullName: string;
  email?: string;              // For password reset & notifications
  matricNo?: string;           // Required for students (e.g. U2021/557001)
  staffId?: string;            // For lecturers
  college: CampusCollege;      // CBAS, CHMS, CHAS
  department: string;          // e.g. Computer Science
  faculty?: string;            // Optional faculty
  level?: AcademicLevel;       // 100 to 600
  coursesTaught?: string[];    // Courses for lecturers
  teacherVerified: boolean;    // true only when A1B2C3D4E5 key provided
  registeredAt: string;
}

export interface SlideBankDeck {
  id: string;
  college: CampusCollege;
  level: AcademicLevel;
  department: string;
  courseCode: string;
  courseTitle: string;
  deckTitle: string;
  slides: ClassSlide[];
  totalPages: number;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  downloadable: boolean;
}

export interface CampusCourse {
  id: string;
  college: CampusCollege;
  courseCode: string;
  title: string;
  department: string;
  level: AcademicLevel;
  creditUnits: number;
  lecturerName: string;
  lecturerId?: string;
}

export interface CampusTimetableSlot {
  id: string;
  college: CampusCollege;
  courseCode: string;
  courseTitle: string;
  department: string;
  level: AcademicLevel;
  lecturerName: string;
  lecturerId?: string;
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "10:00"
  venue: string;
  activeRoomId?: string;
  isInSession: boolean;
}

export interface CampusStorageQuota {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  percentUsed: number;
  slidesCount: number;
  tenantCode: string;
}

export interface ClassSlide {
  id: string;
  pageNumber: number;
  imageUrl: string;
  title?: string;
  notes?: string;
  sizeBytes?: number;
}

export interface ClassRoom {
  id: string;
  join_code: string;
  title: string;
  course_code?: string | null;
  college?: CampusCollege | null;
  academic_level?: AcademicLevel | null;
  department?: string | null;
  lecturer_id: string;
  lecturer_name: string;
  lecturer_avatar?: string | null;
  is_live: boolean;
  current_slide_index: number;
  total_slides: number;
  slides_downloadable: boolean;
  notes_downloadable: boolean;
  slides_data: ClassSlide[];
  lecturer_notes: string;
  recording_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassMember {
  id: string;
  room_id: string;
  user_id: string;
  name: string;
  handle: string;
  avatar_url?: string | null;
  role: ClassRole;
  matric_no?: string;
  college?: CampusCollege;
  academic_level?: AcademicLevel;
  department?: string;
  is_muted: boolean;
  hand_raised: boolean;
  hand_raised_at?: string | null;
  audio_level?: number; // 0 to 1
  is_speaking?: boolean;
}

export interface NotesDiffEvent {
  text: string;
  caretIndex?: number;
  isTyping: boolean;
  senderId: string;
  timestamp: number;
}

export interface SlideChangeEvent {
  slideIndex: number;
  senderId: string;
  timestamp: number;
}

export interface LiveBridgeEvent {
  roomId: string;
  joinCode: string;
  courseCode: string;
  title: string;
  college?: CampusCollege;
  level: AcademicLevel;
  department: string;
  lecturerName: string;
  startedAt: string;
  activeAttendees: number;
}
