// Genuine Flick View Counter & Tracking Module (Strictly Realtime & Organic)

const STORAGE_PREFIX = "flick:genuine_views:";
const LEGACY_STORAGE_PREFIX = "flick:post_views:";
const sessionViewed = new Set<string>();

// One-time cleanup of legacy synthetic views from previous versions
try {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEGACY_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
} catch {}

/**
 * Returns strictly real persistent view count for a flick.
 * Newly posted flicks start at 0 views.
 */
export function getFlickViews(postId: string, _createdAt?: string, _likeCount: number = 0): number {
  if (!postId) return 0;
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${postId}`);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {}

  // Brand new posts start strictly at 0 real views
  return 0;
}

/**
 * Increment view count for a flick strictly once per session when rendered or viewed.
 * No synthetic bonuses, 100% genuine user count.
 */
export function recordFlickView(postId: string, createdAt?: string, likeCount: number = 0): number {
  if (!postId) return 0;
  const current = getFlickViews(postId, createdAt, likeCount);

  if (sessionViewed.has(postId)) {
    return current;
  }
  sessionViewed.add(postId);

  const next = current + 1;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${postId}`, next.toString());
    window.dispatchEvent(
      new CustomEvent("flick:view-count-updated", { detail: { postId, views: next } })
    );
  } catch {}

  return next;
}

/**
 * Format view count cleanly for social feed (e.g. 1.2k, 14.5k, 420)
 */
export function formatFlickViews(views: number): string {
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return views.toString();
}
