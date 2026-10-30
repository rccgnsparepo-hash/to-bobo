/**
 * Offline Cache & Resilient Network Engine for Flick
 * Allows full offline operation across Web, Android APK, and Windows EXE.
 * Speaks authentic Nigerian Pidgin voice prompt when connection drops:
 * "You no get internet again o! Check your connection, you dey browse for offline mode."
 */

export interface CachedFeed {
  posts: unknown[];
  stories: unknown[];
  savedAt: number;
}

const CACHE_KEYS = {
  feed: "flick:offline:home_feed",
  stories: "flick:offline:stories",
  wallpapers: "flick:offline:wallpapers",
  readingHistory: "flick:offline:reading_history",
  profilePrefix: "flick:offline:profile:",
};

let hasSpokenOffline = false;

/**
 * Play a gentle musical alert chime using Web Audio API
 */
function playOfflineChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Warm two-tone alert
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(390, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch {}
}

/**
 * Announce offline state with Optimus Prime audio
 */
export function playOfflineVoiceAlert(force = false) {
  if (typeof window === "undefined") return;
  if (hasSpokenOffline && !force) return;
  hasSpokenOffline = true;

  try {
    playOfflineChime();
    // Play authentic Optimus Prime Guardian voice alert
    const audio = new Audio("/assets/aistudio/Optimus-Prime-2026-10-30-09-06-I-am-the-Father_-I-provide-Guardiance-here_-and_285918b1.mp3");
    audio.volume = 0.95;
    audio.play().catch(() => {});
  } catch (err) {
    console.warn("Offline audio error:", err);
  }
}

export function playOnlineVoiceAlert() {
  if (typeof window === "undefined") return;
  hasSpokenOffline = false;

  try {
    // Play authentic Optimus Prime "Welcome to Flick" when connection restored
    const audio = new Audio("/assets/aistudio/Optimus-Prime-2026-10-30-09-04-Welcome-to-Flick_76cf21e1.mp3");
    audio.volume = 0.95;
    audio.play().catch(() => {});
  } catch {}
}

/**
 * Initialize global offline listeners
 */
export function initOfflineEngine(onStatusChange?: (isOnline: boolean) => void) {
  if (typeof window === "undefined") return () => {};

  const handleOffline = () => {
    if (!hasSpokenOffline) {
      hasSpokenOffline = true;
      playOfflineVoiceAlert();
      setTimeout(() => {
        hasSpokenOffline = false;
      }, 15000);
    }
    if (onStatusChange) onStatusChange(false);
    window.dispatchEvent(
      new CustomEvent("flick:connectivity-changed", { detail: { isOnline: false } })
    );
  };

  const handleOnline = () => {
    playOnlineVoiceAlert();
    if (onStatusChange) onStatusChange(true);
    window.dispatchEvent(
      new CustomEvent("flick:connectivity-changed", { detail: { isOnline: true } })
    );
  };

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
  };
}

/**
 * Cache posts & feed locally for offline viewing
 */
export function saveFeedOffline(posts: unknown[], stories?: unknown[]) {
  try {
    const payload: CachedFeed = {
      posts: posts.slice(0, 80),
      stories: (stories ?? []).slice(0, 30),
      savedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEYS.feed, JSON.stringify(payload));
  } catch {}
}

export function getOfflineFeed(): CachedFeed | null {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.feed);
    if (!raw) return null;
    return JSON.parse(raw) as CachedFeed;
  } catch {
    return null;
  }
}

/**
 * Cache wallpapers catalogue
 */
export function saveWallpapersOffline(pins: unknown[]) {
  try {
    localStorage.setItem(
      CACHE_KEYS.wallpapers,
      JSON.stringify({ pins: pins.slice(0, 100), savedAt: Date.now() })
    );
  } catch {}
}

export function getOfflineWallpapers(): unknown[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.wallpapers);
    if (!raw) return [];
    return JSON.parse(raw).pins || [];
  } catch {
    return [];
  }
}
