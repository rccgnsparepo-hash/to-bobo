import { supabase } from "@/integrations/supabase/client";
import { triggerNotchNotification } from "@/components/notifications/NotchNotification";
import { notificationAudio } from "@/lib/notificationAudio";
import { triggerLightHaptic } from "@/lib/haptics";
import { soundEngine } from "@/lib/soundEngine";
import { isNotificationCategoryEnabled } from "@/lib/appPrefs";

export interface RealtimeNotificationsOptions {
  userId: string;
  navigate: (to: string) => void;
  getCurrentPath?: () => string;
}

/** Synthesize a pleasant notification chime */
export function playNotificationChime() {
  if (!soundEngine.isSoundEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    osc2.frequency.setValueAtTime(1174.66, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now + 0.05);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  } catch {}
}

/**
 * Request desktop & mobile push notifications permission.
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") {
    ensureServiceWorkerRegistration();
    return "granted";
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      ensureServiceWorkerRegistration();
      try {
        localStorage.setItem("flick:push-enabled", "true");
      } catch {}
    }
    return perm;
  } catch (err) {
    console.warn("[realtimeNotifications] requestPermission error:", err);
    return "denied";
  }
}

/**
 * Helper to ensure a Service Worker is registered for background notifications
 */
function ensureServiceWorkerRegistration() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) {
          navigator.serviceWorker
            .register("/OneSignalSDKWorker.js", { scope: "/" })
            .catch(() => {});
        }
      })
      .catch(() => {});
  } catch {}
}

/**
 * Send an OS-level desktop / mobile notification.
 * Works even when user is minimized, tab is hidden, or looking at another window.
 * Uses a 3-layer delivery strategy:
 * 1. Native Capacitor (Android APK)
 * 2. ServiceWorkerRegistration.showNotification (standard for Chrome, Android PWA, Edge, Firefox)
 * 3. Window Notification constructor (fallback for legacy desktop)
 */
export async function sendDesktopNotification({
  title,
  body,
  icon,
  tag,
  url,
  onClick,
}: {
  title: string;
  body: string;
  icon?: string | null;
  tag?: string;
  url?: string;
  onClick?: () => void;
}) {
  const targetUrl = url || "/messages";
  const iconUrl = icon || "/icon-192.png";
  const notifTag = tag || `flick-msg-${Date.now()}`;

  // 1. Native Capacitor Android OS Notifications
  try {
    const { isNativePlatform } = await import("@/lib/native/platform");
    if (isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 1000000),
            channelId: "messages",
            smallIcon: "ic_launcher",
            extra: { url: targetUrl },
          },
        ],
      });
      return;
    }
  } catch {}

  // Check browser Notification permission
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  // 2. Service Worker Registration showNotification (Primary & most reliable for background / minimized)
  let swHandled = false;
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: iconUrl,
          badge: "/icon-192.png",
          tag: notifTag,
          renotify: true,
          vibrate: [120, 60, 120],
          data: { url: targetUrl },
        });
        swHandled = true;
      } else if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_NOTIFICATION",
          title,
          options: {
            body,
            icon: iconUrl,
            badge: "/icon-192.png",
            tag: notifTag,
            renotify: true,
            vibrate: [120, 60, 120],
            data: { url: targetUrl },
          },
        });
        swHandled = true;
      }
    } catch (err) {
      console.warn("[realtimeNotifications] SW notification error:", err);
    }
  }

  // 3. Fallback: window.Notification (desktop standard)
  if (!swHandled) {
    try {
      const notif = new Notification(title, {
        body,
        icon: iconUrl,
        badge: "/icon-192.png",
        tag: notifTag,
      });

      notif.onclick = () => {
        try {
          window.focus();
        } catch {}
        notif.close();
        if (onClick) {
          onClick();
        } else {
          window.dispatchEvent(
            new CustomEvent("flick:push-navigate", { detail: { url: targetUrl } })
          );
        }
      };
    } catch (err) {
      console.warn("[realtimeNotifications] Desktop notification fallback failed:", err);
    }
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
 * Initialize the continuous real-time notification engine.
 * PUSHES notifications no matter where the user is:
 * - On the Home feed (/)
 * - On News (/news)
 * - On Profile/Me (/profile)
 * - In Stories or Explore
 * - OR when the app is minimized, in another browser tab, or backgrounded.
 */
export function initRealtimePushEngine({
  userId,
  navigate,
  getCurrentPath,
}: RealtimeNotificationsOptions): () => void {
  if (!userId) return () => {};

  // Ensure service worker is prepped for background notifications
  ensureServiceWorkerRegistration();

  // In-memory deduplication cache to ensure notifications fire exactly once
  const processedIds = new Map<string, number>();

  const isDuplicate = (id: string): boolean => {
    const now = Date.now();
    if (processedIds.has(id)) return true;
    processedIds.set(id, now);
    if (processedIds.size > 200) {
      for (const [k, t] of processedIds.entries()) {
        if (now - t > 30000) processedIds.delete(k);
      }
    }
    return false;
  };

  /**
   * Core dispatcher when a message arrives
   */
  const handleInboundMessage = async (msg: {
    id?: string;
    sender_id?: string;
    senderId?: string;
    recipient_id?: string;
    content?: string | null;
    media_type?: string | null;
    senderName?: string;
    senderHandle?: string;
    senderAvatar?: string | null;
  }) => {
    const messageId = msg.id || `msg-${Date.now()}`;
    if (isDuplicate(messageId)) return;

    const senderId = msg.sender_id || msg.senderId;
    if (!senderId || senderId === userId) return;

    // Check if user is looking at this exact conversation in the foreground right now
    const currentPath = getCurrentPath ? getCurrentPath() : (typeof window !== "undefined" ? window.location.pathname : "");
    const isAppVisible = typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
    const isLookingAtThisThread =
      isAppVisible &&
      (currentPath === `/messages/${senderId}` || currentPath.startsWith(`/messages/${senderId}/`));

    // If active in foreground thread, the thread UI already displays it
    if (isLookingAtThisThread) {
      window.dispatchEvent(new CustomEvent("flick:dm-unread-updated", { detail: { increment: 1 } }));
      return;
    }

    // Resolve sender profile information
    let senderName = msg.senderName;
    let senderHandle = msg.senderHandle;
    let senderAvatar = msg.senderAvatar;

    if (!senderName || !senderHandle) {
      try {
        const { data: sender } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .eq("id", senderId)
          .single();

        if (sender) {
          senderName = sender.display_name || sender.handle || "Someone";
          senderHandle = sender.handle || "user";
          senderAvatar = sender.avatar_url;
        }
      } catch {}
    }

    senderName = senderName || "Someone";
    senderHandle = senderHandle || "user";

    const mediaSnippet =
      msg.media_type === "audio"
        ? "🎙️ Voice message"
        : msg.media_type === "image"
          ? "📷 Photo"
          : msg.media_type === "video"
            ? "🎥 Video"
            : "Sent a message";

    const messagePreview = (msg.content && msg.content.trim().length > 0) ? msg.content : mediaSnippet;
    const threadUrl = `/messages/${senderId}`;

    // 1. Light haptic feedback
    try {
      triggerLightHaptic();
    } catch {}

    // Check if DMs notification is enabled in user settings
    if (!isNotificationCategoryEnabled("message")) {
      return;
    }

    // 2. Play notification sound chime and optional voice announcement
    if (soundEngine.isSoundEnabled() || notificationAudio.isVoiceEnabled()) {
      void notificationAudio.playNotificationAudio("message", {
        id: senderId,
        display_name: senderName,
        handle: senderHandle,
        avatar_url: senderAvatar,
      });
    }

    // 3. Dynamic Island / Notch In-App Notification Banner (Visible on Home, News, Me, Explore, etc.)
    triggerNotchNotification({
      kind: "message",
      title: senderName,
      message: messagePreview,
      actor: {
        id: senderId,
        display_name: senderName,
        handle: senderHandle,
        avatar_url: senderAvatar,
      },
      url: threadUrl,
    });

    // 4. OS Desktop / Mobile Push Notification (Fires when minimized, hidden, or tab inactive)
    const isMinimizedOrBackground =
      typeof document === "undefined" || document.hidden || !document.hasFocus();

    if (isMinimizedOrBackground) {
      void sendDesktopNotification({
        title: `${senderName} sent you a Flick ⚡️`,
        body: messagePreview,
        icon: senderAvatar,
        tag: `dm-${senderId}`,
        url: threadUrl,
        onClick: () => {
          navigate(threadUrl);
        },
      });
    }

    // 5. Update unread DM counters in real-time
    window.dispatchEvent(new CustomEvent("flick:dm-unread-updated", { detail: { increment: 1 } }));
    window.dispatchEvent(new Event("flick:notifications-updated"));
  };

  /**
   * Channel 1: Instant peer-to-peer broadcast for messages, typing indicators, and duel challenges
   */
  const broadcastChannel = supabase
    .channel(`dm-events-${userId}`)
    .on("broadcast", { event: "new-message" }, (evt) => {
      const payload = evt.payload as Record<string, unknown>;
      if (payload) {
        void handleInboundMessage(payload);
      }
    })
    .on("broadcast", { event: "user-typing" }, (evt) => {
      const payload = evt.payload as {
        senderId?: string;
        displayName?: string;
        handle?: string;
        avatarUrl?: string;
        isTyping?: boolean;
      };
      if (payload?.senderId) {
        window.dispatchEvent(
          new CustomEvent("flick:dm-typing-update", { detail: payload })
        );
      }
    })
    .on("broadcast", { event: "duel-invite" }, (evt) => {
      const payload = evt.payload as Record<string, unknown>;
      if (payload) {
        window.dispatchEvent(
          new CustomEvent("flick:duel-invite-received", { detail: payload })
        );
      }
    })
    .on("broadcast", { event: "duel-response" }, (evt) => {
      const payload = evt.payload as Record<string, unknown>;
      if (payload) {
        window.dispatchEvent(
          new CustomEvent("flick:duel-response-received", { detail: payload })
        );
      }
    })
    .subscribe();

  /**
   * Channel 2: Supabase Postgres database changes on messages table
   */
  const dbMessagesChannel = supabase
    .channel(`realtime-messages-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        const msg = payload.new as Record<string, unknown>;
        if (msg) {
          void handleInboundMessage(msg);
        }
      }
    )
    .subscribe();

  /**
   * Channel 3: Supabase Postgres database changes on notifications table (likes, comments, mentions, stories)
   */
  const dbNotifsChannel = supabase
    .channel(`realtime-inbox-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const n = payload.new as {
          id: string;
          kind: string;
          actor_id: string | null;
          title: string;
          body: string | null;
          url: string | null;
        };

        if (!n || !n.id || n.actor_id === userId) return;
        if (isDuplicate(`notif-${n.id}`)) return;
        // Skip messages here as handleInboundMessage handles them with full rich context
        if (n.kind === "message") return;

        // Fetch actor info
        let actorInfo: { id: string; display_name: string; handle: string; avatar_url: string | null } | undefined;
        if (n.actor_id) {
          try {
            const { data } = await supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .eq("id", n.actor_id)
              .single();
            if (data) actorInfo = data;
          } catch {}
        }

        const kind = (n.kind as any) || "system";
        const title = n.title || "New notification";
        const message = n.body || "";
        const url = n.url || "/";

        // Check if user turned off this notification category in Settings
        if (!isNotificationCategoryEnabled(kind)) {
          return;
        }

        // In-app notch
        triggerNotchNotification({
          kind,
          title,
          message,
          actor: actorInfo,
          url,
        });

        // Sound chime
        if (soundEngine.isSoundEnabled() || notificationAudio.isVoiceEnabled()) {
          void notificationAudio.playNotificationAudio(kind, actorInfo);
        }

        // Desktop OS notification if backgrounded
        if (typeof document !== "undefined" && (document.hidden || !document.hasFocus())) {
          void sendDesktopNotification({
            title,
            body: message,
            icon: actorInfo?.avatar_url,
            tag: `notif-${n.id}`,
            url,
            onClick: () => {
              navigate(url);
            },
          });
        }

        window.dispatchEvent(new Event("flick:notifications-updated"));
      }
    )
    .subscribe();

  /**
   * Channel 4: Real-time typing indicators
   */
  const typingChannel = supabase
    .channel(`dm-typing-${userId}`)
    .on("broadcast", { event: "user-typing" }, (evt) => {
      const p = evt.payload as {
        senderId: string;
        isTyping?: boolean;
      };

      if (!p || !p.senderId || p.senderId === userId) return;

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
    supabase.removeChannel(broadcastChannel);
    supabase.removeChannel(dbMessagesChannel);
    supabase.removeChannel(dbNotifsChannel);
    supabase.removeChannel(typingChannel);
  };
}
