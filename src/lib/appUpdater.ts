export type AppUpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseDate?: string;
  changelog?: string[];
  source: string;
  checkedAt: number;
};

const CURRENT_VERSION = "2.2.0";
const UPDATE_ENDPOINT = "https://itzflick.vercel.app/version.json";
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
          source: res.source || "https://itzflick.vercel.app",
          checkedAt: Date.now(),
        };
      }
    } catch {}
  }

  // 2. Fetch from live endpoint (itzflick.vercel.app or local version.json)
  try {
    const res = await fetch(UPDATE_ENDPOINT, {
      cache: "no-store",
      headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
    }).catch(() => fetch("/version.json", { cache: "no-store" }));

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
        source: data.updateSource || "https://itzflick.vercel.app",
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
    source: "https://itzflick.vercel.app",
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
