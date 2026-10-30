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

export class SpaceService {
  // ==================== 1. LIVE BROADCASTS ====================
  public static getLiveSessions(): LiveBroadcastSession[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LIVE_SESSIONS_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static subscribeToLiveSessions(callback: (sessions: LiveBroadcastSession[]) => void): () => void {
    callback(this.getLiveSessions());

    const handler = () => {
      callback(this.getLiveSessions());
    };
    window.addEventListener("flick:space-live-updated", handler);

    const chTopic = "space:live_hub_realtime";
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${chTopic}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(chTopic)
      .on("broadcast", { event: "live:created" }, () => handler())
      .on("broadcast", { event: "live:status_changed" }, () => handler())
      .subscribe();

    return () => {
      window.removeEventListener("flick:space-live-updated", handler);
      supabase.removeChannel(channel);
    };
  }

  public static createLiveSession(
    session: Omit<LiveBroadcastSession, "id" | "createdAt" | "status" | "viewerCount" | "likesCount">
  ): LiveBroadcastSession {
    const list = this.getLiveSessions();
    const newSession: LiveBroadcastSession = {
      ...session,
      id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      status: "starting",
      viewerCount: 1,
      likesCount: 0,
    };
    const updated = [newSession, ...list];
    try {
      localStorage.setItem(LIVE_SESSIONS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("flick:space-live-updated"));
    } catch {}

    // Broadcast session created event via Supabase
    void supabase.channel("space:global").send({
      type: "broadcast",
      event: "live:created",
      payload: newSession,
    });

    return newSession;
  }

  public static updateLiveStatus(sessionId: string, status: LiveBroadcastSession["status"]): void {
    const list = this.getLiveSessions();
    const target = list.find((s) => s.id === sessionId);
    if (target) {
      target.status = status;
      if (status === "live") target.startedAt = Date.now();
      if (status === "ended") target.endedAt = Date.now();
      try {
        localStorage.setItem(LIVE_SESSIONS_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("flick:space-live-updated"));
      } catch {}

      void supabase.channel(`space:live:${sessionId}`).send({
        type: "broadcast",
        event: "live:status_changed",
        payload: { sessionId, status },
      });
    }
  }

  public static incrementLiveLikes(sessionId: string): void {
    const list = this.getLiveSessions();
    const target = list.find((s) => s.id === sessionId);
    if (target) {
      target.likesCount += 1;
      try {
        localStorage.setItem(LIVE_SESSIONS_KEY, JSON.stringify(list));
      } catch {}
    }
  }

  // ==================== 2. AUDIO ROOMS ====================
  public static getAudioRooms(): AudioRoom[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(AUDIO_ROOMS_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static getRooms(): AudioRoom[] {
    return this.getAudioRooms();
  }

  public static subscribeToRooms(callback: (rooms: AudioRoom[]) => void): () => void {
    callback(this.getAudioRooms());

    const handler = () => {
      callback(this.getAudioRooms());
    };
    window.addEventListener("flick:space-rooms-updated", handler);

    const chTopic = "space:rooms_hub_realtime";
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${chTopic}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(chTopic)
      .on("broadcast", { event: "room:created" }, () => handler())
      .subscribe();

    return () => {
      window.removeEventListener("flick:space-rooms-updated", handler);
      supabase.removeChannel(channel);
    };
  }

  public static createAudioRoom(
    room: Omit<AudioRoom, "id" | "createdAt" | "participants" | "isActive">,
    hostParticipant: RoomParticipant
  ): AudioRoom {
    const list = this.getAudioRooms();
    const newRoom: AudioRoom = {
      ...room,
      id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      isActive: true,
      participants: [hostParticipant],
    };
    const updated = [newRoom, ...list];
    try {
      localStorage.setItem(AUDIO_ROOMS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("flick:space-rooms-updated"));
    } catch {}

    void supabase.channel("space:global").send({
      type: "broadcast",
      event: "room:created",
      payload: newRoom,
    });

    return newRoom;
  }

  public static joinAudioRoom(roomId: string, participant: RoomParticipant): void {
    const list = this.getAudioRooms();
    const target = list.find((r) => r.id === roomId);
    if (target) {
      if (!target.participants.some((p) => p.userId === participant.userId)) {
        target.participants.push(participant);
        try {
          localStorage.setItem(AUDIO_ROOMS_KEY, JSON.stringify(list));
          window.dispatchEvent(new CustomEvent("flick:space-rooms-updated"));
        } catch {}
      }
    }
  }

  public static leaveAudioRoom(roomId: string, userId: string): void {
    const list = this.getAudioRooms();
    const target = list.find((r) => r.id === roomId);
    if (target) {
      target.participants = target.participants.filter((p) => p.userId !== userId);
      // If host left and no participants, mark inactive
      if (target.participants.length === 0) {
        target.isActive = false;
      }
      try {
        localStorage.setItem(AUDIO_ROOMS_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("flick:space-rooms-updated"));
      } catch {}
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
