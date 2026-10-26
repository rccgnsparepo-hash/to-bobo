export type AppUpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseDate?: string;
  changelog?: string[];
  source: string;
  checkedAt: number;
};

export type SyncLogLevel = "info" | "stream" | "patch" | "verify" | "success" | "warn";

export type SyncStreamLog = {
  id: string;
  time: string;
  level: SyncLogLevel;
  tag: string;
  message: string;
  chunkIndex?: number;
  totalChunks?: number;
  size?: string;
  speed?: string;
};

export type SyncModule = {
  id: string;
  name: string;
  size: string;
  category: "core" | "ui" | "audio" | "feed" | "wasm";
  status: "idle" | "streaming" | "ready";
  progress: number;
};

export const SYNC_MODULES_LIST: Omit<SyncModule, "status" | "progress">[] = [
  { id: "mod-1", name: "vendor-react-dom.esm.chunk.js", size: "520 KB", category: "core" },
  { id: "mod-2", name: "app-routes-navigation.chunk.js", size: "194 KB", category: "core" },
  { id: "mod-3", name: "wallpapers-infinite-scroll-engine.js", size: "84 KB", category: "ui" },
  { id: "mod-4", name: "audio-synthesizer-faaaaah.wasm", size: "410 KB", category: "audio" },
  { id: "mod-5", name: "ui-theme-glassmorphism.chunk.css", size: "112 KB", category: "ui" },
  { id: "mod-6", name: "presence-realtime-connector.js", size: "96 KB", category: "core" },
  { id: "mod-7", name: "creator-insights-d3-analytics.js", size: "280 KB", category: "ui" },
  { id: "mod-8", name: "direct-messages-instant-inbox.js", size: "340 KB", category: "ui" },
  { id: "mod-9", name: "media-storage-lossless-compressor.wasm", size: "610 KB", category: "wasm" },
  { id: "mod-10", name: "notifications-notch-banner-v3.js", size: "144 KB", category: "ui" },
  { id: "mod-11", name: "story-reels-fluid-player.chunk.js", size: "215 KB", category: "feed" },
  { id: "mod-12", name: "offline-resilience-indexeddb-cache.js", size: "180 KB", category: "core" },
  { id: "mod-13", name: "user-session-token-refresh.js", size: "92 KB", category: "core" },
  { id: "mod-14", name: "hot-reload-virtual-dom-injector.js", size: "136 KB", category: "core" },
];

const CURRENT_VERSION = "2.2.0";
const UPDATE_ENDPOINT = "/version.json";
const LAST_CHECK_KEY = "flick:last_update_check";

export async function checkForAppUpdates(): Promise<AppUpdateInfo> {
  const electronAPI = typeof window !== "undefined" ? (window as unknown as { electronAPI?: { checkForUpdates?: () => Promise<any> } }).electronAPI : undefined;

  // 1. If running inside Electron, use the native IPC bridge first
  if (electronAPI?.checkForUpdates) {
    try {
      const res = await electronAPI.checkForUpdates();
      if (res && res.success) {
        return {
          currentVersion: CURRENT_VERSION,
          latestVersion: res.latestVersion || CURRENT_VERSION,
          hasUpdate: Boolean(res.hasUpdate),
          changelog: res.changelog || [],
          source: res.source || "Cloud Release Network",
          checkedAt: Date.now(),
        };
      }
    } catch {}
  }

  // 2. Fetch from live endpoint (version.json)
  try {
    const res = await fetch(UPDATE_ENDPOINT, {
      cache: "no-store",
      headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
    });

    if (res && res.ok) {
      const data = await res.json();
      const latest = String(data.version || CURRENT_VERSION);
      const hasUpdate = latest !== CURRENT_VERSION;
      const info: AppUpdateInfo = {
        currentVersion: CURRENT_VERSION,
        latestVersion: latest,
        hasUpdate,
        releaseDate: data.releaseDate,
        changelog: data.changelog || [],
        source: data.updateSource || "Cloud Release Network",
        checkedAt: Date.now(),
      };
      localStorage.setItem(LAST_CHECK_KEY, JSON.stringify(info));
      return info;
    }
  } catch (err) {
    console.warn("[AppUpdater] Offline or check failed:", err);
  }

  return {
    currentVersion: CURRENT_VERSION,
    latestVersion: CURRENT_VERSION,
    hasUpdate: false,
    source: "Cloud Release Network",
    checkedAt: Date.now(),
  };
}

export async function applyInAppUpdate(): Promise<boolean> {
  const electronAPI = typeof window !== "undefined" ? (window as unknown as { electronAPI?: { applyHotUpdate?: () => Promise<{ success: boolean }> } }).electronAPI : undefined;

  if (electronAPI?.applyHotUpdate) {
    const res = await electronAPI.applyHotUpdate();
    return res?.success ?? false;
  }

  // Web / PWA hot reload
  if (typeof window !== "undefined") {
    // Clear cache storages and hard reload
    if ("caches" in window) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch {}
    }
    window.location.reload();
    return true;
  }

  return false;
}
