// Notification payload → in-app route. Called from OneSignal click handler AND
// from `App.appUrlOpen` for cold-start deep links (flick://posts/xyz).
import type { NavigateFunction } from "react-router-dom";
import { APP_URL_SCHEME } from "@/config/onesignal";

export type NotifKind =
  | "message" | "group_message" | "message_reply" | "message_reaction"
  | "like" | "like_comment" | "like_story"
  | "post" | "trending" | "mention" | "tag"
  | "story" | "story_mention" | "story_reply"
  | "news";

export type NotifPayload = {
  type?: NotifKind | string;
  resourceId?: string;
  senderId?: string;
  deepLink?: string; // absolute route, e.g. "/messages/abc" or "flick://..."
  [k: string]: unknown;
};

/** Map a notification payload to a React Router path. Returns null when unroutable. */
export function payloadToPath(data: NotifPayload | null | undefined): string | null {
  if (!data) return null;
  // Explicit deepLink wins.
  if (typeof data.deepLink === "string" && data.deepLink) {
    return normalizePath(data.deepLink);
  }
  const id = String(data.resourceId ?? "");
  switch (data.type) {
    case "message":
    case "group_message":
    case "message_reply":
    case "message_reaction":
      return id ? `/messages/${id}` : "/messages";
    case "like":
    case "trending":
    case "post":
    case "mention":
    case "tag":
      return id ? `/?post=${encodeURIComponent(id)}` : "/";
    case "like_comment":
      return id ? `/?post=${encodeURIComponent(id)}` : "/";
    case "story":
    case "story_mention":
    case "story_reply":
    case "like_story":
      return id ? `/?story=${encodeURIComponent(id)}` : "/";
    case "news":
      return id ? `/news/read?id=${encodeURIComponent(id)}` : "/news";
    default:
      return null;
  }
}

/** Strip a flick:// scheme prefix and normalize to a relative path. */
export function normalizePath(input: string): string {
  let s = input.trim();
  const scheme = `${APP_URL_SCHEME}://`;
  if (s.startsWith(scheme)) s = "/" + s.slice(scheme.length);
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try { const u = new URL(s); s = u.pathname + u.search + u.hash; } catch { /* noop */ }
  }
  if (!s.startsWith("/")) s = "/" + s;
  return s;
}

/** Guard against double-navigation when both OS + JS handlers fire near-simultaneously. */
let lastPath: { path: string; at: number } | null = null;
export function navigateOnce(nav: NavigateFunction, path: string) {
  const now = Date.now();
  if (lastPath && lastPath.path === path && now - lastPath.at < 800) return;
  lastPath = { path, at: now };
  nav(path);
}
