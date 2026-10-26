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
 * Announce offline state with authentic Pidgin pronunciation and Nigerian accent prioritization
 */
export function playOfflineVoiceAlert(force = false) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    playOfflineChime();

    // Natural Nigerian Pidgin phrasing with rhythm markers for TTS engines
    const phrase = "You no get internet again o! Check your connection, you dey browse for offline mode.";
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = 0.94; // rhythmic, unhurried West African cadence
    utterance.pitch = 1.08; // slightly melodic intonation
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    // 1. Prefer Nigerian English (en-NG)
    const ngVoice = voices.find((v) => {
      const l = v.lang.toLowerCase().replace("_", "-");
      const n = v.name.toLowerCase();
      return l === "en-ng" || l.includes("ng") || n.includes("nigeria");
    });

    // 2. Fallback to West/South African English
    const regionalVoice = voices.find((v) => {
      const l = v.lang.toLowerCase().replace("_", "-");
      return l.startsWith("en-gh") || l.startsWith("en-za");
    });

    // 3. Fallback to clean natural English
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith("en") && !v.name.toLowerCase().includes("whisper")
    );

    utterance.voice = ngVoice || regionalVoice || naturalVoice || null;

    // Small delay so audio context chime rings first
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 120);
  } catch (err) {
    console.warn("Speech synthesis fallback:", err);
  }
}

export function playOnlineVoiceAlert() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Network don set! You are back online.");
    utterance.rate = 1.02;
    utterance.pitch = 1.05;
    utterance.volume = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const ngVoice = voices.find((v) => v.lang.toLowerCase().includes("ng"));
    if (ngVoice) utterance.voice = ngVoice;

    window.speechSynthesis.speak(utterance);
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
