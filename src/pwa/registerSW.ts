// Guarded PWA service-worker registration.
// - Never registers in dev, iframe preview, or Lovable preview hostnames.
// - Supports ?sw=off kill switch: unregisters the app SW and exits.
// - Uses vite-plugin-pwa's virtual module in prod, so updates are auto-applied.

const PREVIEW_HOSTS = [
  (h: string) => h.startsWith("id-preview--") || h.startsWith("preview--"),
  (h: string) => h === "lovableproject.com" || h.endsWith(".lovableproject.com"),
  (h: string) => h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com"),
  (h: string) => h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev"),
];

const inIframe = () => { try { return window.self !== window.top; } catch { return true; } };
const isPreviewHost = () => {
  const h = location.hostname;
  return PREVIEW_HOSTS.some((f) => f(h));
};
const killSwitch = () => new URL(location.href).searchParams.get("sw") === "off";

async function unregisterAppSWs() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.map(async (r) => {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      // Only touch our own app SW — leave OneSignalSDKWorker.js alone.
      if (/\/sw\.js(\?|$)/.test(url) || /\/sw-push\.js(\?|$)/.test(url) || /\/service-worker\.js(\?|$)/.test(url)) {
        try { await r.unregister(); } catch { /* noop */ }
      }
    }),
  );
}

export async function registerAppSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD || inIframe() || isPreviewHost() || killSwitch()) {
    await unregisterAppSWs();
    return;
  }
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch (e) {
    console.warn("[pwa] register failed", e);
  }
}