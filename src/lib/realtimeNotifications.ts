import { supabase } from "@/integrations/supabase/client";
import { triggerNotchNotification } from "@/components/notifications/NotchNotification";

export interface RealtimeNotificationsOptions {
  userId: string;
  navigate: (to: string) => void;
  currentPath: string;
}

// Track audio chime cache
let audioContext: AudioContext | null = null;

export function playNotificationChime() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "sine";
    const now = audioContext.currentTime;

    // Friendly bright snap chime (dual tone)
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

/**
 * Request desktop push notifications permission.
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return "denied";
  }
}

/**
 * Send an OS-level desktop notification (works even when user is minimized or outside the app).
 */
export function sendDesktopNotification({
  title,
  body,
  icon,
  tag,
  onClick,
}: {
  title: string;
  body: string;
  icon?: string | null;
  tag?: string;
  onClick?: () => void;
}) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  try {
    const notif = new Notification(title, {
      body,
      icon: icon || "/icon-192.png",
      badge: "/icon-192.png",
      tag: tag || "flick-notification",
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
      if (onClick) onClick();
    };
  } catch (err) {
    console.warn("[realtimeNotifications] Desktop notification failed:", err);
  }
}

/**
 * System tray & Windows startup preferences management
 */
export const TRAY_PREF_KEY = "flick:pref_tray_minimize";
export const STARTUP_PREF_KEY = "flick:pref_startup_launch";

export function getDesktopAppPrefs() {
  try {
    return {
      minimizeToTray: localStorage.getItem(TRAY_PREF_KEY) === "true",
      launchOnStartup: localStorage.getItem(STARTUP_PREF_KEY) === "true",
    };
  } catch {
    return { minimizeToTray: true, launchOnStartup: true };
  }
}

export function setDesktopAppPref(key: "tray" | "startup", enabled: boolean) {
  try {
    if (key === "tray") localStorage.setItem(TRAY_PREF_KEY, String(enabled));
    if (key === "startup") localStorage.setItem(STARTUP_PREF_KEY, String(enabled));
  } catch {}
}

/**
 * Initialize the continuous real-time notification engine for DMs and typing.
 * Continuously pushes notifications even when the user is in the News section, Home, Profile,
 * or outside the app/minimized in desktop tray.
 */
export function initRealtimePushEngine({
  userId,
  navigate,
  currentPath,
}: RealtimeNotificationsOptions) {
  // In-memory deduplication cache for messages to prevent duplicate alerts
  const processedMessageIds = new Map<string, number>();

  // 1. Listen for ALL incoming messages addressed to this user
  const dmChannel = supabase
    .channel(`realtime-dms-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `recipient_id=eq.${userId}`,
      },
      async (payload) => {
        const msg = payload.new as {
          id: string;
          sender_id: string;
          content: string | null;
          media_type: string | null;
        };

        if (!msg || !msg.sender_id) return;

        // Deduplication check: ignore if already processed in last 15s
        const now = Date.now();
        if (processedMessageIds.has(msg.id)) return;
        processedMessageIds.set(msg.id, now);
        if (processedMessageIds.size > 200) {
          for (const [k, t] of processedMessageIds.entries()) {
            if (now - t > 30000) processedMessageIds.delete(k);
          }
        }

        // Check if user is currently looking at this active thread in foreground
        const isCurrentlyInThread =
          currentPath === `/messages/${msg.sender_id}` &&
          document.visibilityState === "visible" &&
          document.hasFocus();

        if (isCurrentlyInThread) return;

        // Fetch sender's profile for rich notification
        const { data: sender } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .eq("id", msg.sender_id)
          .single();

        const senderName = sender?.display_name || sender?.handle || "Someone";
        const messagePreview =
          msg.content || (msg.media_type ? `Sent a ${msg.media_type}` : "Sent a Flick");

        // Audio chime alert only when not in active foreground thread
        playNotificationChime();

        // Push In-App Notch Banner (Takes user directly to the DM)
        triggerNotchNotification({
          kind: "dm",
          title: senderName,
          message: messagePreview,
          actor: {
            id: msg.sender_id,
            display_name: senderName,
            handle: sender?.handle || "user",
            avatar_url: sender?.avatar_url,
          },
          url: `/messages/${msg.sender_id}`,
        });

        // Push Desktop / System Tray Notification ONLY if app window is unfocused or hidden
        if (document.hidden || !document.hasFocus()) {
          sendDesktopNotification({
            title: `${senderName} sent you a Flick ⚡️`,
            body: messagePreview,
            icon: sender?.avatar_url,
            tag: `msg-${msg.id}`,
            onClick: () => {
              navigate(`/messages/${msg.sender_id}`);
            },
          });
        }
      }
    )
    .subscribe();

  // 2. Listen for Real-time Typing indicators (In-app presence only: NEVER sends desktop/OS notifications or chimes)
  const typingChannel = supabase
    .channel(`dm-typing-${userId}`)
    .on("broadcast", { event: "user-typing" }, (evt) => {
      const p = evt.payload as {
        senderId: string;
        handle?: string;
        displayName?: string;
        avatarUrl?: string;
        isTyping?: boolean;
      };

      if (!p || !p.senderId || p.senderId === userId) return;

      // Transient in-app event for conversation lists and status badges ONLY
      window.dispatchEvent(
        new CustomEvent("flick:peer-typing", {
          detail: {
            senderId: p.senderId,
            isTyping: !!p.isTyping,
          },
        })
      );
    })
    .subscribe();

  return () => {
    supabase.removeChannel(dmChannel);
    supabase.removeChannel(typingChannel);
  };
}
