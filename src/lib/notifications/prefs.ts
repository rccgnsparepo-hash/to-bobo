// Layer 10 — User Preferences.
// Locally persisted, instantly applied notification controls. Read by the
// notification center (display filtering) and by notify() (suppression).
import { useEffect, useState } from "react";

export type NotifPrefs = {
  message: boolean;
  comment: boolean;
  like: boolean;
  story: boolean;
  post: boolean;
  mention: boolean;
  sound: boolean;
  vibrate: boolean;
  quietHours: boolean;
  quietFrom: number; // hour 0-23
  quietTo: number; // hour 0-23
};

export const DEFAULT_PREFS: NotifPrefs = {
  message: true,
  comment: true,
  like: true,
  story: true,
  post: true,
  mention: true,
  sound: true,
  vibrate: true,
  quietHours: false,
  quietFrom: 22,
  quietTo: 7,
};

const KEY = "flick:notif-prefs";

export function readPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: NotifPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event("flick:notif-prefs-changed"));
}

/** True when the current time falls inside the user's configured quiet hours. */
export function inQuietHours(p = readPrefs(), at = new Date()): boolean {
  if (!p.quietHours) return false;
  const h = at.getHours();
  return p.quietFrom <= p.quietTo
    ? h >= p.quietFrom && h < p.quietTo
    : h >= p.quietFrom || h < p.quietTo;
}

/** Should a notification of this kind surface (sound/vibration/OS toast)? */
export function kindEnabled(kind: string, p = readPrefs()): boolean {
  if (inQuietHours(p)) return false;
  return (p as unknown as Record<string, boolean>)[kind] !== false;
}

export function useNotifPrefs() {
  const [prefs, setPrefs] = useState<NotifPrefs>(readPrefs);
  useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    window.addEventListener("flick:notif-prefs-changed", sync);
    return () => window.removeEventListener("flick:notif-prefs-changed", sync);
  }, []);
  const update = (patch: Partial<NotifPrefs>) => {
    const next = { ...readPrefs(), ...patch };
    writePrefs(next);
    setPrefs(next);
  };
  return { prefs, update };
}
