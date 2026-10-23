import { notificationAudio } from "@/lib/notificationAudio";
import { triggerNotchNotification } from "@/components/notifications/NotchNotification";
import { supabase } from "@/integrations/supabase/client";

export type NotifyKind =
  | "post"
  | "message"
  | "story"
  | "comment"
  | "like"
  | "mention"
  | "typing"
  | "reaction"
  | "follow"
  | "verification"
  | "system"
  | "other";

export type NotifyInput = {
  kind: NotifyKind;
  title?: string;
  message?: string;
  url?: string;
  actor?: { id?: string; handle?: string | null; display_name?: string | null } | null;
  data?: Record<string, unknown>;
  recipients?: string[];
  dedupe_id?: string | null;
};

/**
 * Perfect notification: centralized, cross-platform notification delivery for in-app notch,
 * browser/system notifications, native Capacitor local notifications, Electron bridge, sound + TTS, vibration.
 */
const recentPerfectNotifications = new Map<string, number>();

export async function perfectNotify(input: NotifyInput) {
  // STRICT RULE: Typing must NEVER create OS notifications or push alerts
  if (input.kind === "typing") {
    return;
  }

  if (input.dedupe_id) {
    const last = recentPerfectNotifications.get(input.dedupe_id);
    const now = Date.now();
    if (last && now - last < 15000) return;
    recentPerfectNotifications.set(input.dedupe_id, now);
  }

  try {
    const title = input.title ?? (input.actor?.display_name ?? input.actor?.handle ?? "Flick");
    const body = input.message ?? "";

    // 1) In-app banner + visual
    try {
      triggerNotchNotification({
        kind: input.kind,
        title: title,
        message: body,
        url: input.url,
        actor: input.actor ?? undefined,
        data: input.data,
      });
      // Let other listeners know
      window.dispatchEvent(new Event("flick:notifications-updated"));
    } catch (e) {
      /* ignore */
    }

    // 2) Play notification audio + optional TTS (best-effort)
    try {
      await notificationAudio.playNotificationAudio(input.kind as any, input.actor as any, undefined);
    } catch (e) {
      console.warn("[perfectNotify] audio failed", e);
    }

    // 3) Vibration (short pattern)
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([30, 40, 30]);
    } catch {}

    // 4) Electron bridge (if available)
    try {
      const electronBridge = (window as unknown as any)?.electronAPI;
      if (electronBridge?.showNotification) {
        electronBridge.showNotification({ title, body, url: input.url });
        electronBridge.flashFrame?.();
      }
    } catch {}

    // 5) Browser Notification (ServiceWorker.showNotification if possible, else Notification API)
    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification && Notification.permission === "granted") {
          reg.showNotification(title, {
            body,
            icon: input.actor?.id ? undefined : "/icon-192.png",
            tag: input.dedupe_id || `${input.kind}:${input.data ? JSON.stringify(input.data) : ""}`,
            data: { url: input.url },
          });
        } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification(title, { body, icon: input.actor?.id ? undefined : "/icon-192.png" });
          if (input.url) n.onclick = () => {
            window.focus();
            window.dispatchEvent(new CustomEvent("flick:push-navigate", { detail: { url: input.url } }));
          };
        }
      } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(title, { body, icon: "/icon-192.png" });
        if (input.url) n.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent("flick:push-navigate", { detail: { url: input.url } }));
        };
      }
    } catch (e) {
      console.warn("[perfectNotify] system notification failed", e);
    }

    // 6) Capacitor native local notification (best-effort)
    try {
      const { isNativePlatform } = await import("@/lib/native/platform");
      if (isNativePlatform()) {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const channelId = input.kind === "message" ? "messages" : input.kind === "story" ? "stories" : input.kind === "like" ? "likes" : "posts";
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Math.floor(Math.random() * 1000000),
              channelId,
              smallIcon: "ic_launcher",
              extra: { url: input.url },
            },
          ],
        });
      }
    } catch (e) {
      console.warn("[perfectNotify] native local notification failed", e);
    }

    // 7) (Optional) Server-side fallback: if app cannot reach push gateway, consider queuing — leave to notify() caller
  } catch (err) {
    console.warn("[perfectNotify] unexpected error", err);
  }
}
