// Real-Time Space Service: Live Broadcasts, Audio Rooms, Classroom & Recordings
import { supabase } from "@/integrations/supabase/client";
import type {
  LiveBroadcastSession,
  LiveChatMessage,
  LiveReaction,
  AudioRoom,
  RoomParticipant,
  ClassroomSession,
  PrepClassSession,
  AudioRecording,
  CallRecord,
} from "./types";

const LIVE_SESSIONS_KEY = "flick:space_live_sessions_v1";
const AUDIO_ROOMS_KEY = "flick:space_audio_rooms_v1";
const CLASSROOMS_KEY = "flick:space_classrooms_v1";
const PREP_SESSIONS_KEY = "flick:space_prep_sessions_v1";
const RECORDINGS_KEY = "flick:space_recordings_v1";
const CALL_HISTORY_KEY = "flick:space_call_history_v1";

const GLOBAL_SPACE_CHANNEL = "flick:space_global_hub";

// Shared in-memory caches for fast reactivity
const liveSessionsMap = new Map<string, LiveBroadcastSession>();
const audioRoomsMap = new Map<string, AudioRoom>();

// Track local active broadcaster / room presence tokens
let currentLiveSessionId: string | null = null;
let currentAudioRoomId: string | null = null;

let globalChannel: ReturnType<typeof supabase.channel> | null = null;
let isChannelInitialized = false;

function loadInitialCaches() {
  if (typeof window === "undefined") return;
  try {
    const rawLive = localStorage.getItem(LIVE_SESSIONS_KEY);
    if (rawLive) {
      const parsed: LiveBroadcastSession[] = JSON.parse(rawLive);
      parsed.forEach((s) => {
        // Discard sessions older than 4 hours if ended
        if (s.status === "ended" && Date.now() - (s.endedAt || s.createdAt) > 4 * 3600 * 1000) return;
        liveSessionsMap.set(s.id, s);
      });
    }
  } catch {}

  try {
    const rawRooms = localStorage.getItem(AUDIO_ROOMS_KEY);
    if (rawRooms) {
      const parsed: AudioRoom[] = JSON.parse(rawRooms);
      parsed.forEach((r) => {
        if (!r.isActive && Date.now() - r.createdAt > 4 * 3600 * 1000) return;
        audioRoomsMap.set(r.id, r);
      });
    }
  } catch {}
}

loadInitialCaches();

function persistLiveSessions() {
  try {
    const list = Array.from(liveSessionsMap.values());
    localStorage.setItem(LIVE_SESSIONS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("flick:space-live-updated"));
  } catch {}
}

function persistAudioRooms() {
  try {
    const list = Array.from(audioRoomsMap.values());
    localStorage.setItem(AUDIO_ROOMS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("flick:space-rooms-updated"));
  } catch {}
}

function ensureGlobalChannel(): ReturnType<typeof supabase.channel> {
  if (globalChannel && isChannelInitialized) return globalChannel;

  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${GLOBAL_SPACE_CHANNEL}`);
  if (existing) {
    globalChannel = existing;
    isChannelInitialized = true;
    return globalChannel;
  }

  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const ch = supabase.channel(GLOBAL_SPACE_CHANNEL, {
    config: {
      broadcast: { self: true },
      presence: { key: clientId },
    },
  });

  ch.on("broadcast", { event: "live:created" }, ({ payload }) => {
    if (payload && payload.id) {
      liveSessionsMap.set(payload.id, payload);
      persistLiveSessions();
    }
  })
    .on("broadcast", { event: "live:status_changed" }, ({ payload }) => {
      if (payload && payload.sessionId) {
        const target = liveSessionsMap.get(payload.sessionId);
        if (target) {
          target.status = payload.status;
          if (payload.status === "live") target.startedAt = target.startedAt || Date.now();
          if (payload.status === "ended") target.endedAt = Date.now();
          persistLiveSessions();
        }
      }
    })
    .on("broadcast", { event: "live:likes" }, ({ payload }) => {
      if (payload && payload.sessionId) {
        const target = liveSessionsMap.get(payload.sessionId);
        if (target) {
          target.likesCount = payload.likesCount;
          persistLiveSessions();
        }
      }
    })
    .on("broadcast", { event: "room:created" }, ({ payload }) => {
      if (payload && payload.id) {
        audioRoomsMap.set(payload.id, payload);
        persistAudioRooms();
      }
    })
    .on("broadcast", { event: "room:status_changed" }, ({ payload }) => {
      if (payload && payload.roomId) {
        const target = audioRoomsMap.get(payload.roomId);
        if (target) {
          target.isActive = payload.isActive;
          persistAudioRooms();
        }
      }
    })
    .on("broadcast", { event: "room:participants" }, ({ payload }) => {
      if (payload && payload.roomId) {
        const target = audioRoomsMap.get(payload.roomId);
        if (target) {
          target.participants = payload.participants;
          persistAudioRooms();
        }
      }
    })
    .on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{
        type?: "broadcast" | "room";
        session?: LiveBroadcastSession;
        room?: AudioRoom;
      }>();

      let liveChanged = false;
      let roomsChanged = false;

      // Extract all presence items
      Object.values(state).forEach((presences) => {
        presences.forEach((p) => {
          if (p.type === "broadcast" && p.session?.id) {
            liveSessionsMap.set(p.session.id, p.session);
            liveChanged = true;
          } else if (p.type === "room" && p.room?.id) {
            audioRoomsMap.set(p.room.id, p.room);
            roomsChanged = true;
          }
        });
      });

      if (liveChanged) persistLiveSessions();
      if (roomsChanged) persistAudioRooms();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        isChannelInitialized = true;
      }
    });

  globalChannel = ch;
  return ch;
}

export class SpaceService {
  // ==================== 1. LIVE BROADCASTS ====================
  public static getLiveSessions(): LiveBroadcastSession[] {
    ensureGlobalChannel();
    return Array.from(liveSessionsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public static getActiveLiveSessions(): LiveBroadcastSession[] {
    return this.getLiveSessions().filter((s) => s.status === "live" || s.status === "starting");
  }

  public static isUserLive(userId: string): boolean {
    if (!userId) return false;
    return Array.from(liveSessionsMap.values()).some(
      (s) => s.hostId === userId && (s.status === "live" || s.status === "starting")
    );
  }

  public static getUserLiveSession(userId: string): LiveBroadcastSession | null {
    if (!userId) return null;
    return (
      Array.from(liveSessionsMap.values()).find(
        (s) => s.hostId === userId && (s.status === "live" || s.status === "starting")
      ) || null
    );
  }

  public static subscribeToLiveSessions(callback: (sessions: LiveBroadcastSession[]) => void): () => void {
    ensureGlobalChannel();
    callback(this.getLiveSessions());

    const handler = () => {
      callback(this.getLiveSessions());
    };
    window.addEventListener("flick:space-live-updated", handler);

    return () => {
      window.removeEventListener("flick:space-live-updated", handler);
    };
  }

  public static createLiveSession(
    session: Omit<LiveBroadcastSession, "id" | "createdAt" | "status" | "viewerCount" | "likesCount">
  ): LiveBroadcastSession {
    const ch = ensureGlobalChannel();
    const newSession: LiveBroadcastSession = {
      ...session,
      id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      status: "live",
      viewerCount: 1,
      likesCount: 0,
    };

    liveSessionsMap.set(newSession.id, newSession);
    currentLiveSessionId = newSession.id;
    persistLiveSessions();

    // 1. Send authoritative broadcast to all connected clients immediately
    void ch.send({
      type: "broadcast",
      event: "live:created",
      payload: newSession,
    });

    // 2. Track presence so late-joining viewers instantly discover the active stream
    void ch.track({
      type: "broadcast",
      sessionId: newSession.id,
      session: newSession,
      onlineAt: Date.now(),
    });

    return newSession;
  }

  public static updateLiveStatus(sessionId: string, status: LiveBroadcastSession["status"]): void {
    const ch = ensureGlobalChannel();
    const target = liveSessionsMap.get(sessionId);
    if (target) {
      target.status = status;
      if (status === "live") target.startedAt = target.startedAt || Date.now();
      if (status === "ended") target.endedAt = Date.now();
      persistLiveSessions();

      void ch.send({
        type: "broadcast",
        event: "live:status_changed",
        payload: { sessionId, status },
      });

      if (status === "ended") {
        if (currentLiveSessionId === sessionId) {
          currentLiveSessionId = null;
          void ch.untrack();
        }
      }
    }
  }

  public static incrementLiveLikes(sessionId: string): void {
    const ch = ensureGlobalChannel();
    const target = liveSessionsMap.get(sessionId);
    if (target) {
      target.likesCount += 1;
      persistLiveSessions();

      void ch.send({
        type: "broadcast",
        event: "live:likes",
        payload: { sessionId, likesCount: target.likesCount },
      });
    }
  }

  // ==================== 2. AUDIO ROOMS ====================
  public static getAudioRooms(): AudioRoom[] {
    ensureGlobalChannel();
    return Array.from(audioRoomsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public static getRooms(): AudioRoom[] {
    return this.getAudioRooms();
  }

  public static isUserInRoom(userId: string): boolean {
    if (!userId) return false;
    return Array.from(audioRoomsMap.values()).some(
      (r) => r.isActive && (r.hostId === userId || r.participants.some((p) => p.userId === userId))
    );
  }

  public static getUserAudioRoom(userId: string): AudioRoom | null {
    if (!userId) return null;
    return (
      Array.from(audioRoomsMap.values()).find(
        (r) => r.isActive && (r.hostId === userId || r.participants.some((p) => p.userId === userId))
      ) || null
    );
  }

  public static subscribeToRooms(callback: (rooms: AudioRoom[]) => void): () => void {
    ensureGlobalChannel();
    callback(this.getAudioRooms());

    const handler = () => {
      callback(this.getAudioRooms());
    };
    window.addEventListener("flick:space-rooms-updated", handler);

    return () => {
      window.removeEventListener("flick:space-rooms-updated", handler);
    };
  }

  public static createAudioRoom(
    room: Omit<AudioRoom, "id" | "createdAt" | "participants" | "isActive">,
    hostParticipant: RoomParticipant
  ): AudioRoom {
    const ch = ensureGlobalChannel();
    const newRoom: AudioRoom = {
      ...room,
      id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      isActive: true,
      participants: [hostParticipant],
    };

    audioRoomsMap.set(newRoom.id, newRoom);
    currentAudioRoomId = newRoom.id;
    persistAudioRooms();

    void ch.send({
      type: "broadcast",
      event: "room:created",
      payload: newRoom,
    });

    void ch.track({
      type: "room",
      roomId: newRoom.id,
      room: newRoom,
      onlineAt: Date.now(),
    });

    return newRoom;
  }

  public static joinAudioRoom(roomId: string, participant: RoomParticipant): void {
    const ch = ensureGlobalChannel();
    const target = audioRoomsMap.get(roomId);
    if (target) {
      if (!target.participants.some((p) => p.userId === participant.userId)) {
        target.participants.push(participant);
        persistAudioRooms();

        void ch.send({
          type: "broadcast",
          event: "room:participants",
          payload: { roomId, participants: target.participants },
        });
      }
    }
  }

  public static leaveAudioRoom(roomId: string, userId: string): void {
    const ch = ensureGlobalChannel();
    const target = audioRoomsMap.get(roomId);
    if (target) {
      target.participants = target.participants.filter((p) => p.userId !== userId);
      if (target.participants.length === 0) {
        target.isActive = false;
        void ch.send({
          type: "broadcast",
          event: "room:status_changed",
          payload: { roomId, isActive: false },
        });
        if (currentAudioRoomId === roomId) {
          currentAudioRoomId = null;
          void ch.untrack();
        }
      } else {
        void ch.send({
          type: "broadcast",
          event: "room:participants",
          payload: { roomId, participants: target.participants },
        });
      }
      persistAudioRooms();
    }
  }

  public static updateParticipantRole(
    roomId: string,
    userId: string,
    updates: Partial<RoomParticipant>
  ): void {
    const list = this.getAudioRooms();
    const target = list.find((r) => r.id === roomId);
    if (target) {
      const p = target.participants.find((part) => part.userId === userId);
      if (p) {
        Object.assign(p, updates);
        try {
          localStorage.setItem(AUDIO_ROOMS_KEY, JSON.stringify(list));
          window.dispatchEvent(new CustomEvent("flick:space-rooms-updated"));
        } catch {}
      }
    }
  }

  // ==================== 3. CLASSROOM SESSIONS ====================
  public static getClassrooms(): ClassroomSession[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(CLASSROOMS_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static async getActiveClassrooms(): Promise<ClassroomSession[]> {
    return this.getClassrooms();
  }

  public static createClassroom(
    lesson: Omit<ClassroomSession, "id" | "status" | "enrolledUserIds" | "attendanceCount" | "announcements">
  ): ClassroomSession {
    const list = this.getClassrooms();
    const newClass: ClassroomSession = {
      ...lesson,
      id: `class_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: "scheduled",
      enrolledUserIds: [lesson.hostId],
      attendanceCount: 1,
      announcements: [
        {
          id: `ann_${Date.now()}`,
          text: `Welcome! Class scheduled for ${new Date(lesson.scheduledTime).toLocaleString()}.`,
          createdAt: Date.now(),
        },
      ],
    };
    const updated = [newClass, ...list];
    try {
      localStorage.setItem(CLASSROOMS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("flick:space-classes-updated"));
    } catch {}

    return newClass;
  }

  public static enrollInClass(classId: string, userId: string): void {
    const list = this.getClassrooms();
    const target = list.find((c) => c.id === classId);
    if (target && !target.enrolledUserIds.includes(userId)) {
      target.enrolledUserIds.push(userId);
      target.attendanceCount += 1;
      try {
        localStorage.setItem(CLASSROOMS_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("flick:space-classes-updated"));
      } catch {}
    }
  }

  // ==================== 4. PREP CLASS STUDY SESSIONS ====================
  public static getPrepSessions(): PrepClassSession[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(PREP_SESSIONS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static savePrepSession(
    session: Omit<PrepClassSession, "id" | "createdAt">
  ): PrepClassSession {
    const list = this.getPrepSessions();
    const newSession: PrepClassSession = {
      ...session,
      id: `prep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const updated = [newSession, ...list];
    try {
      localStorage.setItem(PREP_SESSIONS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("flick:space-prep-updated"));
    } catch {}
    return newSession;
  }

  // ==================== 5. AUDIO RECORDINGS ====================
  public static getRecordings(): AudioRecording[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECORDINGS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveRecording(
    rec: Omit<AudioRecording, "id" | "createdAt">
  ): AudioRecording {
    const list = this.getRecordings();
    const newRec: AudioRecording = {
      ...rec,
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const updated = [newRec, ...list];
    try {
      localStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("flick:space-recordings-updated"));
    } catch {}
    return newRec;
  }

  public static deleteRecording(id: string): void {
    const list = this.getRecordings();
    const filtered = list.filter((r) => r.id !== id);
    try {
      localStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent("flick:space-recordings-updated"));
    } catch {}
  }

  // ==================== 6. CALL HISTORY ====================
  public static getCallHistory(): CallRecord[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(CALL_HISTORY_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static logCall(call: Omit<CallRecord, "id" | "startedAt">): CallRecord {
    const list = this.getCallHistory();
    const newCall: CallRecord = {
      ...call,
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      startedAt: Date.now(),
    };
    const updated = [newCall, ...list.slice(0, 49)];
    try {
      localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("flick:space-calls-updated"));
    } catch {}
    return newCall;
  }
}
