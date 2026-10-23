// Handles native app lifecycle events tied to notifications:
// - Cold-start deep links via `App.appUrlOpen` (flick://...)
// - Router bridge: listens for "flick:notification-open" and navigates once.
import { isNativePlatform } from "./platform";
import { navigateOnce, normalizePath } from "./deepLink";
import type { NavigateFunction } from "react-router-dom";

let bound = false;
export function bindNotificationRouter(nav: NavigateFunction) {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ path: string }>).detail;
    if (detail?.path) navigateOnce(nav, detail.path);
  };
  window.addEventListener("flick:notification-open", handler);

  if (!bound && isNativePlatform()) {
    bound = true;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        App.addListener("appUrlOpen", (ev: { url: string }) => {
          if (!ev?.url) return;
          const path = normalizePath(ev.url);
          navigateOnce(nav, path);
        });
      } catch (e) {
        console.warn("[appLifecycle] appUrlOpen unavailable", e);
      }
    })();
  }

  return () => window.removeEventListener("flick:notification-open", handler);
}
