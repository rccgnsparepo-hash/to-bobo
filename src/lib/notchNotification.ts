import { isNotificationCategoryEnabled } from "@/lib/appPrefs";
import { soundEngine } from "@/lib/soundEngine";

export type NotchStyle = "big-card" | "expanded" | "glow" | "live" | "minimal";

export type NotchNotificationItem = {
  id: string;
  kind: "post" | "message" | "story" | "comment" | "like" | "mention" | "system" | "news";
  title: string;
  message?: string;
  url?: string;
  actor?: {
    id?: string;
    handle?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  timestamp?: number;
  data?: Record<string, unknown>;
};

const STYLE_STORAGE_KEY = "flick:notch-style";

/**
 * Defaults to "big-card" as requested (no compact dynamic island)
 */
export function getStoredNotchStyle(): NotchStyle {
  try {
    const s = localStorage.getItem(STYLE_STORAGE_KEY) as NotchStyle;
    if (s && ["big-card", "expanded", "glow", "live", "minimal"].includes(s)) return s;
  } catch {}
  return "big-card";
}

export function setStoredNotchStyle(style: NotchStyle) {
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, style);
    window.dispatchEvent(new CustomEvent("flick:notch-style-changed", { detail: style }));
  } catch {}
}

export function playNotificationChime() {
  if (!soundEngine.isSoundEnabled()) {
    return; // User disabled notification sound chime in Settings
  }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(1046.5, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12);

    osc2.frequency.setValueAtTime(1567.98, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(2093.0, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.04);
    osc1.stop(now + 0.38);
    osc2.stop(now + 0.38);
  } catch {}
}

/** Dispatches a big in-app push notification banner */
export function triggerNotchNotification(
  item: Omit<NotchNotificationItem, "id" | "timestamp"> & { id?: string }
) {
  // STRICT USER SETTINGS CHECK: Drop notification if category was toggled off
  if (!isNotificationCategoryEnabled(item.kind)) {
    return;
  }

  const fullItem: NotchNotificationItem = {
    id: item.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...item,
  };
  window.dispatchEvent(new CustomEvent("flick:notification-notch", { detail: fullItem }));

  // Also trigger system browser notification if allowed
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(fullItem.title, {
        body: fullItem.message || "New activity on Flick",
        icon: fullItem.actor?.avatar_url || "/icon-192.png",
      });
    } catch {}
  }
}
