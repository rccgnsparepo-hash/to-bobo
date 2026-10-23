// Local screen-time tracking for the "Time management" setting.
const KEY = "flick:usage";

type UsageMap = Record<string, number>; // yyyy-mm-dd -> seconds

const today = () => new Date().toISOString().slice(0, 10);

export const USAGE_EVENT = "flick:usage-updated";
const GRACE_KEY = "flick:usage-grace-until";

export function readUsage(): UsageMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as UsageMap;
  } catch {
    return {};
  }
}

function writeUsage(u: UsageMap) {
  // keep the last 30 days only
  const keys = Object.keys(u).sort().slice(-30);
  const trimmed: UsageMap = {};
  keys.forEach((k) => (trimmed[k] = u[k]));
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* noop */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(USAGE_EVENT, { detail: { today: todaySeconds() } }));
  }
}

export function addUsage(seconds: number) {
  const u = readUsage();
  u[today()] = Math.round((u[today()] ?? 0) + seconds);
  writeUsage(u);
}

export function todaySeconds() {
  return readUsage()[today()] ?? 0;
}

export function todayMinutes() {
  return Math.floor(todaySeconds() / 60);
}

export function weekAverageSeconds() {
  const u = readUsage();
  const days = Object.keys(u).sort().slice(-7);
  if (!days.length) return 0;
  return Math.round(days.reduce((s, d) => s + u[d], 0) / days.length);
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Check if user is in an active grace period after entering PIN */
export function isGracePeriodActive(): boolean {
  try {
    const raw = localStorage.getItem(GRACE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Date.now() < until;
  } catch {
    return false;
  }
}

/** Extend grace period by N minutes (default 15 min) */
export function grantGracePeriod(minutes = 15) {
  try {
    localStorage.setItem(GRACE_KEY, String(Date.now() + minutes * 60 * 1000));
    window.dispatchEvent(new CustomEvent("flick:grace-granted"));
  } catch {
    /* noop */
  }
}

/** Clear grace period (e.g. for testing) */
export function clearGracePeriod() {
  try {
    localStorage.removeItem(GRACE_KEY);
    window.dispatchEvent(new CustomEvent("flick:grace-granted"));
  } catch {
    /* noop */
  }
}

/** Check if the screen time limit has been exceeded and requires a PIN */
export function isDailyLimitExceeded(limitMin: number): boolean {
  if (!limitMin || limitMin <= 0) return false;
  if (isGracePeriodActive()) return false;
  return todaySeconds() >= limitMin * 60;
}

/** Counts time while the app is active. Returns a cleanup function. Works across Web, Electron EXE, and Capacitor APK. */
export function startUsageTracking() {
  let last = Date.now();
  const tick = () => {
    const now = Date.now();
    if (document.visibilityState === "visible") {
      const elapsed = (now - last) / 1000;
      if (elapsed > 0 && elapsed < 60) {
        addUsage(elapsed);
      }
    }
    last = now;
  };
  const id = window.setInterval(tick, 5000);
  const onVis = () => {
    tick();
    last = Date.now();
  };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("beforeunload", tick);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("beforeunload", tick);
  };
}
