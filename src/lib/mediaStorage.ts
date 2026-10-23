/**
 * Media download preferences & cache management for Flick across Web, Android, and Windows.
 */

export type DownloadPolicy = "auto" | "preview_only" | "never";
export type CacheRetention = "3days" | "1week" | "1month" | "forever";

export interface MediaStoragePrefs {
  wifi: DownloadPolicy;
  cellular: DownloadPolicy;
  roaming: DownloadPolicy;
  cacheRetention: CacheRetention;
}

export const MEDIA_STORAGE_PREFS_KEY = "flick:media_storage_prefs";

const DEFAULT_PREFS: MediaStoragePrefs = {
  wifi: "auto",
  cellular: "preview_only",
  roaming: "never",
  cacheRetention: "1week",
};

export function getMediaStoragePrefs(): MediaStoragePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(MEDIA_STORAGE_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveMediaStoragePrefs(prefs: Partial<MediaStoragePrefs>): MediaStoragePrefs {
  const current = getMediaStoragePrefs();
  const next = { ...current, ...prefs };
  try {
    localStorage.setItem(MEDIA_STORAGE_PREFS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("flick:media-prefs-updated", { detail: next }));
  } catch {}
  return next;
}

/**
 * Detect current network connection type with safe browser & platform fallback.
 */
export function getCurrentConnectionType(): {
  type: "wifi" | "cellular" | "unknown";
  isRoaming: boolean;
  isReliable: boolean;
} {
  if (typeof navigator === "undefined") {
    return { type: "unknown", isRoaming: false, isReliable: false };
  }

  // Network Information API (available on Chromium, Android WebView, Chrome, Edge)
  const conn = (navigator as unknown as {
    connection?: {
      type?: string;
      effectiveType?: string;
      saveData?: boolean;
      rtt?: number;
      downlink?: number;
    };
  }).connection;

  if (!conn) {
    // Desktop / Web without connection API — safely assume standard high-speed connection
    return { type: "unknown", isRoaming: false, isReliable: false };
  }

  const netType = conn.type?.toLowerCase();
  const effType = conn.effectiveType?.toLowerCase();

  if (netType === "wifi" || netType === "ethernet") {
    return { type: "wifi", isRoaming: false, isReliable: true };
  }

  if (netType === "cellular" || effType === "2g" || effType === "3g" || effType === "slow-2g") {
    return { type: "cellular", isRoaming: false, isReliable: true };
  }

  if (conn.saveData) {
    return { type: "cellular", isRoaming: false, isReliable: true };
  }

  return { type: "unknown", isRoaming: false, isReliable: false };
}

/**
 * Check whether a media asset should be automatically downloaded/pre-cached
 * based on user preferences and current network state.
 */
export function shouldAutoDownloadMedia(): boolean {
  const prefs = getMediaStoragePrefs();
  const conn = getCurrentConnectionType();

  if (conn.isRoaming && prefs.roaming === "never") {
    return false;
  }

  if (conn.type === "cellular") {
    return prefs.cellular === "auto";
  }

  if (conn.type === "wifi") {
    return prefs.wifi === "auto";
  }

  // If connection type is unknown (e.g. desktop browser), adhere to wifi policy as safe default
  return prefs.wifi === "auto";
}

/**
 * Estimate storage used by cached media in localStorage & CacheStorage.
 */
export async function estimateCachedMediaStorage(): Promise<{
  totalBytes: number;
  formatted: string;
  imageBytes: number;
  videoBytes: number;
  audioBytes: number;
}> {
  let totalBytes = 0;

  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        totalBytes = estimate.usage;
      }
    } catch {}
  }

  // Count localStorage media metadata / cached data
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("flick:media") || key.startsWith("flick:cache"))) {
        totalBytes += (localStorage.getItem(key)?.length || 0) * 2;
      }
    }
  } catch {}

  // Reasonable fallback breakdown
  const imageBytes = Math.round(totalBytes * 0.45);
  const videoBytes = Math.round(totalBytes * 0.4);
  const audioBytes = totalBytes - imageBytes - videoBytes;

  const mb = totalBytes / (1024 * 1024);
  const formatted = mb < 1 ? `${Math.round(totalBytes / 1024)} KB` : `${mb.toFixed(1)} MB`;

  return { totalBytes, formatted, imageBytes, videoBytes, audioBytes };
}

/**
 * Clears all cached media from the local device storage.
 */
export async function clearMediaCache(): Promise<boolean> {
  let cleared = false;
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes("flick") || name.includes("media") || name.includes("dm")) {
          await caches.delete(name);
          cleared = true;
        }
      }
    }

    // Clear media-specific localStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("flick:media") || key.startsWith("flick:blob"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    cleared = true;
  } catch (err) {
    console.warn("[clearMediaCache] Error clearing cache:", err);
  }
  return cleared;
}
