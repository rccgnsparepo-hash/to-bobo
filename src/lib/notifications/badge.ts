// Layer 8 — Badge Manager.
// Single source of truth for the app's global unread badge across
// web (App Badging API), installed PWA, Electron (dock/tray via title) and
// Android launcher (Capacitor Badge plugin when present).

type Nav = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

let current = 0;
const listeners = new Set<(n: number) => void>();
const baseTitle = typeof document !== "undefined" ? document.title : "Flick";

/** Set the global unread badge. Idempotent — repeated identical values are no-ops. */
export function setGlobalBadge(count: number) {
  const n = Math.max(0, Math.floor(count || 0));
  if (n === current) return;
  current = n;

  // 1. Web / PWA / macOS dock via the App Badging API.
  const nav = navigator as Nav;
  try {
    if (n > 0) void nav.setAppBadge?.(n);
    else void nav.clearAppBadge?.();
  } catch {
    /* unsupported — fall through */
  }

  // 2. Document title (Electron taskbar + browser tab fallback).
  try {
    document.title = n > 0 ? `(${n > 99 ? "99+" : n}) ${baseTitle}` : baseTitle;
  } catch {
    /* noop */
  }

  // 3. Electron tray badge over IPC, when the desktop shell exposes it.
  try {
    const el = (window as unknown as { electron?: { setBadgeCount?: (n: number) => void } })
      .electron;
    el?.setBadgeCount?.(n);
  } catch {
    /* noop */
  }

  // 4. Android launcher badge (Capacitor plugin, if installed in the native shell).
  try {
    const cap = (
      window as unknown as {
        Capacitor?: {
          Plugins?: { Badge?: { set: (o: { count: number }) => void; clear: () => void } };
        };
      }
    ).Capacitor;
    const badge = cap?.Plugins?.Badge;
    if (badge) {
      if (n > 0) badge.set({ count: n });
      else badge.clear();
    }
  } catch {
    /* noop */
  }

  listeners.forEach((fn) => fn(n));
}

export function getGlobalBadge() {
  return current;
}

export function onBadgeChange(fn: (n: number) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
