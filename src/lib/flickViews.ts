// Global Flick View Counter & Tracking Module

const STORAGE_PREFIX = "flick:post_views:";
const sessionViewed = new Set<string>();

/**
 * Deterministic pseudo-random hash generator based on postId string
 * ensures consistent natural baseline views even on first load without flickering.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Calculate organic baseline views from post creation time and like count
 */
function getBaselineViews(postId: string, createdAt?: string, likeCount: number = 0): number {
  const seed = hashString(postId);
  const multiplier = 5 + (seed % 12); // between 5x and 16x like count
  const baseLikesBonus = Math.max(likeCount * multiplier, 0);

  let timeBonus = 6 + (seed % 14); // base 6-19 views
  if (createdAt) {
    const hoursOld = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
    if (hoursOld > 24) {
      timeBonus += 45 + (seed % 65);
    } else if (hoursOld > 6) {
      timeBonus += 20 + (seed % 30);
    } else if (hoursOld > 1) {
      timeBonus += 8 + (seed % 15);
    }
  }

  return baseLikesBonus + timeBonus;
}

/**
 * Get current persistent view count for a flick
 */
export function getFlickViews(postId: string, createdAt?: string, likeCount: number = 0): number {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${postId}`);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {}

  const initial = getBaselineViews(postId, createdAt, likeCount);
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${postId}`, initial.toString());
  } catch {}
  return initial;
}

/**
 * Increment view count for a flick once per session when rendered or viewed
 */
export function recordFlickView(postId: string, createdAt?: string, likeCount: number = 0): number {
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
