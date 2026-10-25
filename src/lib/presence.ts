import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PRESENCE_CHANNEL_NAME = "flick-global-presence";
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes of recent activity = Online

// In-memory set of currently online user IDs
let onlineUserIds = new Set<string>();
// In-memory map of latest observed activity timestamps (from typing, DMs, broadcasts, reactions)
const recentActivityMap = new Map<string, number>();
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let currentTrackingUserId: string | null = null;
let heartbeatTimer: number | null = null;

function broadcastPresenceUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("flick:presence-update", {
      detail: {
        onlineIds: Array.from(onlineUserIds),
        recentActivity: Object.fromEntries(recentActivityMap.entries()),
      },
    })
  );
}

/**
 * Register that a given user performed a real-time action (sent a message, is typing, etc.).
 * Immediately marks them Online across the entire client.
 */
export function recordUserActivity(userId: string | null | undefined) {
  if (!userId) return;
  const now = Date.now();
  recentActivityMap.set(userId, now);
  if (!onlineUserIds.has(userId)) {
    onlineUserIds.add(userId);
  }
  broadcastPresenceUpdate();
}

const ONLINE_PRIVACY_KEY = "flick:privacy_show_online";

export function isOnlinePrivacyEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(ONLINE_PRIVACY_KEY);
    return val !== "false";
  } catch {
    return true;
  }
}

export function setOnlinePrivacyEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ONLINE_PRIVACY_KEY, String(enabled));
    broadcastPresenceUpdate();
  } catch {}
}

/**
 * Checks whether a given user is currently online in realtime.
 * WhatsApp-style: Validates internet connectivity + active app session.
 */
export function checkIsOnline(uid: string | null | undefined): boolean {
  if (!uid) return false;
  // If local browser has no internet connection, cannot be online
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }
  if (onlineUserIds.has(uid)) return true;
  const lastActive = recentActivityMap.get(uid);
  if (lastActive && Date.now() - lastActive < ACTIVE_THRESHOLD_MS) {
    return true;
  }
  return false;
}

/**
 * Initialize presence tracking for the authenticated user.
 * Joins the global presence room and tracks presence state with heartbeat.
 */
export function initPresenceTracking(userId: string) {
  if (!userId) return () => {};
  if (currentTrackingUserId === userId && presenceChannel) {
    recordUserActivity(userId);
    return () => {};
  }

  currentTrackingUserId = userId;
  recordUserActivity(userId);

  if (presenceChannel) {
    try {
      supabase.removeChannel(presenceChannel);
    } catch {}
    presenceChannel = null;
  }

  const ch = supabase.channel(PRESENCE_CHANNEL_NAME, {
    config: {
      presence: { key: userId },
    },
  });

  const syncState = () => {
    try {
      const state = ch.presenceState<{ user_id?: string; online_at?: number }>();
      const nextSet = new Set<string>();
      const now = Date.now();

      Object.keys(state).forEach((key) => {
        nextSet.add(key);
        recentActivityMap.set(key, now);
        const presences = state[key];
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p.user_id) {
              nextSet.add(p.user_id);
              recentActivityMap.set(p.user_id, p.online_at || now);
            }
          });
        }
      });

      // Also retain users with recent activity within the active threshold
      recentActivityMap.forEach((timestamp, uid) => {
        if (now - timestamp < ACTIVE_THRESHOLD_MS) {
          nextSet.add(uid);
        } else {
          recentActivityMap.delete(uid);
        }
      });

      onlineUserIds = nextSet;
      broadcastPresenceUpdate();
    } catch {}
  };

  ch.on("presence", { event: "sync" }, syncState);

  ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
    const now = Date.now();
    onlineUserIds.add(key);
    recentActivityMap.set(key, now);
    if (Array.isArray(newPresences)) {
      newPresences.forEach((p: { user_id?: string; online_at?: number }) => {
        if (p?.user_id) {
          onlineUserIds.add(p.user_id);
          recentActivityMap.set(p.user_id, p.online_at || now);
        }
      });
    }
    broadcastPresenceUpdate();
  });

  ch.on("presence", { event: "leave" }, ({ key }) => {
    // If user had activity in the last 45 seconds, don't flap them immediately to offline
    const last = recentActivityMap.get(key) || 0;
    if (Date.now() - last > 45000) {
      onlineUserIds.delete(key);
      broadcastPresenceUpdate();
    }
  });

  // Listen for broadcast presence pings
  ch.on("broadcast", { event: "presence-ping" }, (payload) => {
    const sender = (payload.payload as { userId?: string })?.userId;
    if (sender) {
      recordUserActivity(sender);
    }
  });

  const trackSelf = async () => {
    try {
      recordUserActivity(userId);
      await ch.track({
        user_id: userId,
        online_at: Date.now(),
      });
    } catch {}
  };

  ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await trackSelf();
      try {
        await ch.send({
          type: "broadcast",
          event: "presence-ping",
          payload: { userId },
        });
      } catch {}
    }
  });

  presenceChannel = ch;

  // Periodic heartbeat every 15s to maintain active state and prevent socket timeouts
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void trackSelf();
    }
  }, 15000);

  const onWake = () => {
    void trackSelf();
    syncState();
  };

  window.addEventListener("focus", onWake);
  window.addEventListener("online", onWake);
  document.addEventListener("visibilitychange", onWake);

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    window.removeEventListener("focus", onWake);
    window.removeEventListener("online", onWake);
    document.removeEventListener("visibilitychange", onWake);

    if (presenceChannel === ch) {
      void ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
      presenceChannel = null;
      currentTrackingUserId = null;
    }
  };
}

/**
 * React hook to read the list of currently online users or check a specific user.
 */
export function useOnlinePresence() {
  const [onlineSet, setOnlineSet] = useState<Set<string>>(() => new Set(onlineUserIds));
  const [, setTick] = useState(0);

  useEffect(() => {
    setOnlineSet(new Set(onlineUserIds));

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ onlineIds: string[] }>).detail;
      if (detail?.onlineIds) {
        setOnlineSet(new Set(detail.onlineIds));
      }
    };

    window.addEventListener("flick:presence-update", handler);
    // Periodic re-evaluation every 5s for smooth expiration of offline users
    const ticker = setInterval(() => {
      setTick((t) => t + 1);
      setOnlineSet(new Set(onlineUserIds));
    }, 5000);

    return () => {
      window.removeEventListener("flick:presence-update", handler);
      clearInterval(ticker);
    };
  }, []);

  const isUserOnline = (uid?: string | null): boolean => {
    return checkIsOnline(uid);
  };

  return { onlineUserIds: onlineSet, isUserOnline };
}
