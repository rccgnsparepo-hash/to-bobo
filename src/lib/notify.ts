import { supabase } from "@/integrations/supabase/client";
import { triggerNotchNotification } from "@/lib/notchNotification";
import { isNotificationCategoryEnabled } from "@/lib/appPrefs";

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
  /** Specific recipients to drop into the in-app inbox. Empty/undefined = broadcast (just webhook/onesignal). */
  recipients?: string[];
  /** Optional stable dedupe id so the same logical event won't show twice. */
  dedupe_id?: string | null;
};

/* ---------- Offline queue: notifications never get silently dropped ---------- */

const QUEUE_KEY = "flick:notify-queue";
const readQueue = (): NotifyInput[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as NotifyInput[];
  } catch {
    return [];
  }
};
const writeQueue = (q: NotifyInput[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-50)));
  } catch {
    /* noop */
  }
};
const enqueue = (input: NotifyInput) => writeQueue([...readQueue(), input]);

let flushing = false;
/** Drain queued notifications (called on reconnect and after each successful send). */
export async function flushNotifyQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const queue = readQueue();
    if (!queue.length) return;
    writeQueue([]);
    const failed: NotifyInput[] = [];
    for (const item of queue) {
      const ok = await send(item, 2);
      if (!ok) failed.push(item);
    }
    if (failed.length) writeQueue([...failed, ...readQueue()]);
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushNotifyQueue();
  });
}

/** Invoke the push gateway with bounded exponential-backoff retries. */
async function send(input: NotifyInput, attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.functions.invoke("notify", {
        body: {
          ...input,
          recipients: input.recipients ?? [],
          data: {
            ...(input.data ?? {}),
            app_origin: origin,
          },
        },
      });
      if (!error) return true;
    } catch {
      /* retry */
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * 2 ** i));
  }
  return false;
}

/** Best-effort helper to avoid creating duplicate inbox rows when dedupe_id is present. */
async function insertInboxRowsIfNeeded(rows: any[]) {
  if (!rows.length) return;
  try {
    const dedupeIds = rows.map((r) => (r.data && (r.data as any).dedupe_id) || null).filter(Boolean);
    if (dedupeIds.length === 0) {
      await supabase.from("notifications").insert(rows);
      return;
    }

    const toInsert: any[] = [];
    for (const r of rows) {
      const dedupe = r.data?.dedupe_id ?? null;
      if (!dedupe) {
        toInsert.push(r);
        continue;
      }
      const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", r.user_id)
        .filter("data->>dedupe_id", "eq", String(dedupe));
      if (!data || data.length === 0) toInsert.push(r);
    }
    if (toInsert.length) await supabase.from("notifications").insert(toInsert);
  } catch (e) {
    console.warn("[notify] inbox insert check failed, falling back to insert", e);
    try {
      await supabase.from("notifications").insert(rows);
    } catch {
      /* noop */
    }
  }
}

const recentLocalNotifications = new Map<string, number>();

export async function notify(input: NotifyInput) {
  // STRICT RULE: Typing must NEVER create database rows, push notifications, or OS alerts
  if (input.kind === "typing") {
    return;
  }

  // Deduplication check: prevent duplicate notifications for the same logical event
  if (input.dedupe_id) {
    const last = recentLocalNotifications.get(input.dedupe_id);
    const now = Date.now();
    if (last && now - last < 15000) {
      return; // Already notified recently
    }
    recentLocalNotifications.set(input.dedupe_id, now);
    // Cleanup old keys
    if (recentLocalNotifications.size > 200) {
      for (const [k, t] of recentLocalNotifications.entries()) {
        if (now - t > 30000) recentLocalNotifications.delete(k);
      }
    }
  }

  try {
    const who = input.actor?.display_name ?? input.actor?.handle ?? "Someone";
    const fallbackTitle =
      input.kind === "like"
        ? `${who} liked your flick`
        : input.kind === "comment"
          ? `${who} commented on your flick`
          : input.kind === "message"
            ? `${who} sent you a Flick ⚡️`
            : input.kind === "story"
              ? `${who} posted a story`
              : input.kind === "post"
                ? `${who} just flicked`
                : input.kind === "mention"
                  ? `${who} mentioned you`
                  : input.kind === "follow"
                    ? `${who} is now flicking you`
                    : input.kind === "verification"
                      ? `${who} updated verification`
                      : `${who} updated something`;

    // In-app inbox rows (only for known recipients, never the actor themselves).
    if (input.recipients?.length) {
      const actorId = input.actor?.id ?? null;
      const rows = input.recipients
        .filter((r) => r && r !== actorId)
        .map((user_id) => ({
          user_id,
          actor_id: actorId,
          kind: input.kind,
          title: input.title ?? fallbackTitle,
          body: input.message ?? null,
          url: input.url ?? null,
          data: { ...(input.data ?? {}), dedupe_id: input.dedupe_id ?? null } as never,
        }));
      if (rows.length) await insertInboxRowsIfNeeded(rows);
    }

    let shouldShowNotchLocally = isNotificationCategoryEnabled(input.kind);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id ?? null;
      const actorId = input.actor?.id ?? null;

      if (currentUserId && actorId && actorId === currentUserId) shouldShowNotchLocally = false;

      // Filter: If user is not following the actor, do not show notifications concerning that actor (unless system or direct DM)
      if (currentUserId && actorId && actorId !== currentUserId) {
        if (!["system", "message", "follow"].includes(input.kind)) {
          try {
            const raw = localStorage.getItem(`flick:flicking:${currentUserId}`);
            const following = raw ? (JSON.parse(raw) as string[]) : [];
            if (!following.includes(actorId)) {
              shouldShowNotchLocally = false;
            }
          } catch {}
        }
      }

      if (input.kind === "message" && currentUserId) {
        try {
          const loc = typeof window !== "undefined" ? window.location.pathname : "";
          const sender = (input.data as any)?.senderId ?? input.actor?.id ?? null;
          if (sender && loc && loc.startsWith(`/messages/${sender}`)) {
            shouldShowNotchLocally = false;
          }
        } catch {}
      }
    } catch {}

    if (shouldShowNotchLocally) {
      triggerNotchNotification({
        kind: input.kind,
        title: input.title ?? fallbackTitle,
        message: input.kind === "typing" ? "Typing…" : input.message,
        url: input.url,
        actor: input.actor ?? undefined,
        data: input.data,
      });
      window.dispatchEvent(new Event("flick:notifications-updated"));

      if (typeof window !== "undefined") {
        const electronBridge = (window as unknown as {
          electronAPI?: {
            showNotification: (p: { title: string; body: string; url?: string; message?: string }) => void;
            flashFrame: () => void;
          };
        }).electronAPI;

        if (electronBridge?.showNotification) {
          electronBridge.showNotification({
            title: input.title ?? fallbackTitle,
            body: input.kind === "typing" ? "Typing…" : input.message ?? "",
            url: input.url,
          });
          electronBridge.flashFrame();
        } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            const bodyText = input.kind === "typing" ? "Typing…" : input.message ?? "";
            const notif = new Notification(input.title ?? fallbackTitle, {
              body: bodyText,
              icon: "/icon-192.png",
              tag: input.dedupe_id || `${input.kind}:${input.data ? JSON.stringify(input.data) : ""}`,
            });
            if (input.url) {
              notif.onclick = () => {
                window.focus();
                window.dispatchEvent(new CustomEvent("flick:push-navigate", { detail: { url: input.url } }));
              };
            }
          } catch {
            /* ignore sandbox or iframe security restrictions */
          }
        }

        try {
          const { isNativePlatform } = await import("@/lib/native/platform");
          if (isNativePlatform()) {
            const { LocalNotifications } = await import("@capacitor/local-notifications");
            const channelId =
              input.kind === "message"
                ? "messages"
                : input.kind === "story"
                  ? "stories"
                  : input.kind === "like"
                    ? "likes"
                    : "posts";
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: input.title ?? fallbackTitle,
                  body: input.kind === "typing" ? "Typing…" : input.message ?? "",
                  id: Math.floor(Math.random() * 1000000),
                  channelId,
                  smallIcon: "ic_launcher",
                  extra: { url: input.url },
                },
              ],
            });
          }
        } catch (nativeErr) {
          console.warn("[notify] Capacitor native notification error:", nativeErr);
        }
      }
    }

    if (!navigator.onLine) {
      enqueue(input);
      return;
    }
    const ok = await send(input);
    if (!ok) enqueue(input);
    else void flushNotifyQueue();
  } catch (e) {
    console.warn("notify failed", e);
    enqueue(input);
  }
}

