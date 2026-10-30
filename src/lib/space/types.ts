// Flick Space — Complete Real-Time Social, Live, Audio & Learning Ecosystem Types

export type SpaceTab =
  | "live"
  | "rooms"
  | "calls"
  | "classes"
  | "prep"
  | "recordings"
  | "schedule"
  | "discover";

// ==================== 1. GO LIVE & BROADCASTING ====================
export type LiveSessionStatus = "scheduled" | "starting" | "live" | "ending" | "ended";

export interface LiveBroadcastSession {
  id: string;
  hostId: string;
  hostName: string;
  hostHandle: string;
  hostAvatar?: string | null;
  title: string;
  description?: string;
  category: "Gaming" | "Chit-Chat" | "Music" | "Tech" | "Campus" | "Tutorial" | "Culture";
  visibility: "public" | "followers" | "invite_only";
  coverImageUrl?: string | null;
  status: LiveSessionStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  viewerCount: number;
  likesCount: number;
  allowComments: boolean;
  allowGuestInvites: boolean;
  isAudioOnly?: boolean;
}

export interface LiveChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userHandle: string;
  userAvatar?: string | null;
  message: string;
  timestamp: number;
  isHost?: boolean;
}

export interface LiveReaction {
  id: string;
  emoji: string;
  userId: string;
  timestamp: number;
}

// ==================== 2. FLICK AUDIO ROOMS ====================
export type RoomRole = "host" | "co-host" | "speaker" | "listener";

export interface RoomParticipant {
  userId: string;
  userName: string;
  userHandle: string;
  userAvatar?: string | null;
  role: RoomRole;
  isMuted: boolean;
  isSpeaking: boolean;
  handRaised: boolean;
  joinedAt: number;
}

export interface AudioRoom {
  id: string;
  hostId: string;
  hostName: string;
  hostHandle: string;
  hostAvatar?: string | null;
  title: string;
  topicTag: string;
  roomType:
    | "public"
    | "private"
    | "invite_only"
    | "study"
    | "lecture"
    | "hangout"
    | "panel"
    | "qna";
  description?: string;
  rules?: string;
  maxCapacity: number;
  participants: RoomParticipant[];
  isActive: boolean;
  createdAt: number;
  scheduledFor?: number;
  waitingRoomEnabled?: boolean;
}

// ==================== 3. CALLS (1-on-1 & GROUP) ====================
export type CallStatus = "ringing" | "connecting" | "connected" | "ended" | "missed" | "declined";

export interface CallRecord {
  id: string;
  callerId: string;
  callerName: string;
  callerHandle: string;
  callerAvatar?: string | null;
  recipientIds: string[];
  callType: "audio" | "video";
  status: CallStatus;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
}

// ==================== 4. FLICK CLASSROOM ====================
export interface ClassMaterial {
  id: string;
  title: string;
  type: "document" | "link" | "assignment" | "notes";
  url: string;
  uploadedAt: number;
  fileSize?: string;
}

export interface ClassroomSession {
  id: string;
  hostId: string;
  teacherName: string;
  teacherHandle: string;
  teacherAvatar?: string | null;
  title: string;
  subject: string;
  description: string;
  scheduledTime: number;
  durationMinutes: number;
  timezone: string;
  accessType: "public" | "private" | "invite_only";
  capacity: number;
  enrolledUserIds: string[];
  materials: ClassMaterial[];
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  allowRecording: boolean;
  announcements: { id: string; text: string; createdAt: number }[];
  attendanceCount: number;
}

// ==================== 5. PREP CLASS ====================
export interface PrepStudyGoal {
  id: string;
  title: string;
  completed: boolean;
}

export interface PrepClassSession {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  targetDurationMinutes: number;
  completedMinutes: number;
  goals: PrepStudyGoal[];
  notes: string;
  mockTestConfig?: {
    questionCount: number;
    passedScore: number;
  };
  createdAt: number;
  completedAt?: number;
}

// ==================== 6. RECORDINGS ====================
export interface AudioRecording {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  category: "lecture" | "meeting" | "voice_note" | "space_replay";
  audioUrl: string; // blob: or Supabase storage URL
  durationSeconds: number;
  createdAt: number;
  isPrivate: boolean;
  fileSizeBytes: number;
}

// ==================== 7. SCHEDULE & NATIVE ALARMS ====================
export interface ScheduledReminder {
  id: string;
  userId: string;
  title: string;
  targetType: "live" | "room" | "class" | "prep" | "custom";
  targetId?: string;
  targetUrl?: string;
  triggerTime: number; // Unix timestamp
  timezone: string;
  isRecurring: boolean;
  recurringPattern?: "daily" | "weekly" | "weekdays";
  isCompleted: boolean;
  soundEnabled: boolean;
  createdAt: number;
}
