/**
 * WhatsApp-like Media Download & Storage Management for Flick.
 * Manages auto-download policies across Wi-Fi, Mobile Data, and Roaming,
 * caches media objects securely in local browser/app storage without exposing raw URLs,
 * and tracks cache usage with a safe Clear Cache action that never touches server data.
 */

export type MediaCategoryPrefs = {
  photos: boolean;
  videos: boolean;
  documents: boolean;
};

export type MediaStoragePrefs = {
  autoDownloadWifi: MediaCategoryPrefs;
  autoDownloadMobile: MediaCategoryPrefs;
  autoDownloadRoaming: MediaCategoryPrefs;
  manualOnly: boolean;
};

const STORAGE_PREFS_KEY = "flick:media-storage-prefs";
const MEDIA_CACHE_NAME = "flick-media-v1";
const DOWNLOADED_REGISTRY_KEY = "flick:downloaded-media-registry";

export const DEFAULT_MEDIA_PREFS: MediaStoragePrefs = {
  autoDownloadWifi: {
    photos: true,
    videos: true,
    documents: true,
  },
  autoDownloadMobile: {
    photos: true,
    videos: false,
    documents: false,
  },
  autoDownloadRoaming: {
    photos: false,
    videos: false,
    documents: false,
  },
  manualOnly: false,
};

export function getMediaStoragePrefs(): MediaStoragePrefs {
  if (typeof window === "undefined") return DEFAULT_MEDIA_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (!raw) return DEFAULT_MEDIA_PREFS;
    const parsed = JSON.parse(raw);
    return {
      autoDownloadWifi: { ...DEFAULT_MEDIA_PREFS.autoDownloadWifi, ...(parsed.autoDownloadWifi || {}) },
      autoDownloadMobile: { ...DEFAULT_MEDIA_PREFS.autoDownloadMobile, ...(parsed.autoDownloadMobile || {}) },
      autoDownloadRoaming: { ...DEFAULT_MEDIA_PREFS.autoDownloadRoaming, ...(parsed.autoDownloadRoaming || {}) },
      manualOnly: !!parsed.manualOnly,
    };
  } catch {
    return DEFAULT_MEDIA_PREFS;
  }
}

export function saveMediaStoragePrefs(prefs: MediaStoragePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("flick:media-storage-prefs-changed", { detail: prefs }));
  } catch {
    /* noop */
  }
}

/**
 * Detect current network connection type.
 * Uses @capacitor/network on mobile or Network Information API in Chromium/browsers where available.
 */
export async function detectConnectionType(): Promise<"wifi" | "cellular" | "unknown"> {
  if (typeof window === "undefined") return "unknown";

  try {
    const { isNativePlatform } = await import("@/lib/native/platform");
    if (isNativePlatform()) {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      if (status.connectionType === "wifi") return "wifi";
      if (status.connectionType === "cellular") return "cellular";
      return "unknown";
    }
  } catch {
    /* fallback to web */
  }

  try {
    const nav = navigator as unknown as {
      connection?: { type?: string; effectiveType?: string };
    };
    if (nav.connection) {
      const t = nav.connection.type;
      if (t === "wifi" || t === "ethernet") return "wifi";
      if (t === "cellular") return "cellular";
      const eff = nav.connection.effectiveType;
      if (eff === "4g" || eff === "3g" || eff === "2g") {
        return "cellular";
      }
    }
  } catch {
    /* noop */
  }

  return "wifi"; // Default safe fallback for desktop / unmetered
}

/**
 * Determines whether a given media category should automatically download
 * based on the user's preferences and current network connection.
 */
export async function shouldAutoDownload(mediaCategory: "image" | "video" | "file" | "audio"): Promise<boolean> {
  const prefs = getMediaStoragePrefs();
  if (prefs.manualOnly) return false;

  const key: keyof MediaCategoryPrefs =
    mediaCategory === "image" ? "photos" : mediaCategory === "video" ? "videos" : "documents";

  const connection = await detectConnectionType();
  if (connection === "cellular") {
    return prefs.autoDownloadMobile[key];
  }
  // Wi-Fi or unmetered desktop connection
  return prefs.autoDownloadWifi[key];
}

/**
 * Track IDs of media items that the user has explicitly or automatically downloaded locally.
 */
export function getDownloadedMediaRegistry(): Record<string, { size: number; type: string; downloadedAt: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DOWNLOADED_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordMediaDownloaded(idOrPath: string, type: string, size: number): void {
  if (typeof window === "undefined" || !idOrPath) return;
  try {
    const reg = getDownloadedMediaRegistry();
    reg[idOrPath] = { size, type, downloadedAt: Date.now() };
    localStorage.setItem(DOWNLOADED_REGISTRY_KEY, JSON.stringify(reg));
    window.dispatchEvent(new Event("flick:media-cache-updated"));
  } catch {
    /* noop */
  }
}

export function isMediaLocallyDownloaded(idOrPath: string): boolean {
  if (!idOrPath) return false;
  const reg = getDownloadedMediaRegistry();
  return !!reg[idOrPath];
}

/**
 * Retrieve cached blob URL for a media item if available in browser Cache API.
 */
export async function getCachedMediaUrl(urlOrPath: string): Promise<string | null> {
  if (typeof window === "undefined" || typeof caches === "undefined" || !urlOrPath) return null;
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const match = await cache.match(new Request(urlOrPath, { mode: "no-cors" }));
    if (match) {
      const blob = await match.blob();
      if (blob && blob.size > 0) {
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    /* noop */
  }
  return null;
}

/**
 * Cache an authorized media response into local Cache API.
 */
export async function storeMediaInLocalCache(urlOrPath: string, blob: Blob, type: string): Promise<void> {
  if (typeof window === "undefined" || typeof caches === "undefined" || !urlOrPath || !blob) return;
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const response = new Response(blob, {
      headers: {
        "Content-Type": blob.type || (type === "video" ? "video/mp4" : "image/jpeg"),
        "Content-Length": String(blob.size),
      },
    });
    await cache.put(new Request(urlOrPath, { mode: "no-cors" }), response);
    recordMediaDownloaded(urlOrPath, type, blob.size);
  } catch (err) {
    console.warn("[mediaStoragePrefs] Cache store failed:", err);
  }
}

export type MediaCacheStats = {
  photoCount: number;
  videoCount: number;
  docCount: number;
  totalSizeMb: number;
  totalItems: number;
};

/**
 * Calculate total local cached media usage.
 */
export async function getMediaCacheStats(): Promise<MediaCacheStats> {
  const reg = getDownloadedMediaRegistry();
  let photos = 0;
  let videos = 0;
  let docs = 0;
  let totalBytes = 0;

  for (const item of Object.values(reg)) {
    totalBytes += item.size || 0;
    if (item.type === "image" || item.type === "photo") photos++;
    else if (item.type === "video") videos++;
    else docs++;
  }

  // Also check Cache API keys if available
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(MEDIA_CACHE_NAME);
      const keys = await cache.keys();
      if (keys.length > 0 && Object.keys(reg).length === 0) {
        totalBytes = keys.length * 450 * 1024; // Approximation
        photos = keys.length;
      }
    } catch {}
  }

  return {
    photoCount: photos,
    videoCount: videos,
    docCount: docs,
    totalSizeMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
    totalItems: photos + videos + docs,
  };
}

/**
 * Clear local media cache safely.
 * IMPORTANT: Strictly deletes only local temporary cached files from device.
 * Never touches or deletes messages or server originals on Supabase Storage.
 */
export async function clearLocalMediaCache(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      await caches.delete(MEDIA_CACHE_NAME);
    }
  } catch {}

  try {
    localStorage.removeItem(DOWNLOADED_REGISTRY_KEY);
    window.dispatchEvent(new Event("flick:media-cache-updated"));
  } catch {}
}
