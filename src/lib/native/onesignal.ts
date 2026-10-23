// Single-init OneSignal orchestrator for the Capacitor native shell.
// Web preview is a no-op — web push continues to run through src/lib/push.ts.
//
// Lifecycle:
//   App launch → Capacitor ready → initOneSignal() (once) → requestPermission
//     → subscription id → login(externalUserId) after auth
//     → sign-out → logout()
//
// Click handler resolves the payload to a route and hands it to the router
// via `window.flick:notification-open` (AppShell listens and calls navigate).
import { isNativePlatform } from "./platform";
import { ensureNotificationChannels } from "./channels";
import { ONESIGNAL_APP_ID } from "@/config/onesignal";
import { supabase } from "@/integrations/supabase/client";
import { payloadToPath, type NotifPayload } from "./deepLink";
import { toast } from "sonner";

type OneSignalStatic = {
  initialize: (appId: string) => void;
  Notifications: {
    requestPermission: (fallbackToSettings: boolean) => Promise<boolean>;
    addEventListener: (
      event: "click" | "foregroundWillDisplay" | "permissionChange",
      cb: (ev: unknown) => void,
    ) => void;
  };
  User: {
    pushSubscription: {
      getIdAsync: () => Promise<string | null | undefined>;
      addEventListener: (event: "change", cb: (ev: unknown) => void) => void;
    };
    addTag: (key: string, value: string) => void;
    removeTag: (key: string) => void;
  };
  login: (externalId: string) => void;
  logout: () => void;
};

let initPromise: Promise<OneSignalStatic | null> | null = null;
let currentExternalId: string | null = null;
let clickHandlerBound = false;

/** Initialize the OneSignal SDK exactly once. Returns the plugin, or null on web/no-config. */
export function initOneSignal(): Promise<OneSignalStatic | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!isNativePlatform()) return null;
    if (!ONESIGNAL_APP_ID) {
      console.warn("[onesignal] ONESIGNAL_APP_ID not configured — see src/config/onesignal.ts");
      return null;
    }
    try {
      const mod = (await import("onesignal-cordova-plugin")) as unknown as { default?: OneSignalStatic } & OneSignalStatic;
      const OneSignal = (mod.default ?? mod) as OneSignalStatic;
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // Foreground: show the OS notification AND surface a toast + refresh hint.
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", (raw) => {
        try {
          const ev = raw as { notification?: { title?: string; body?: string; additionalData?: NotifPayload }; preventDefault?: () => void };
          const n = ev?.notification;
          if (n?.title || n?.body) {
            toast(n?.title ?? "New notification", { description: n?.body ?? undefined });
          }
          // Broadcast so the affected screen can refetch.
          window.dispatchEvent(new CustomEvent("flick:notification-received", { detail: n?.additionalData ?? {} }));
          window.dispatchEvent(new Event("flick:notifications-updated"));
        } catch (e) { console.warn("[onesignal] foreground handler failed", e); }
      });

      // Tap handler: route into the app once.
      if (!clickHandlerBound) {
        clickHandlerBound = true;
        OneSignal.Notifications.addEventListener("click", (raw) => {
          try {
            const ev = raw as { notification?: { additionalData?: NotifPayload; launchURL?: string } };
            const data = ev?.notification?.additionalData ?? {};
            const path = payloadToPath(data) ?? (ev?.notification?.launchURL ? new URL(ev.notification.launchURL, "http://l").pathname : null);
            if (path) {
              window.dispatchEvent(new CustomEvent("flick:notification-open", { detail: { path } }));
            }
          } catch (e) { console.warn("[onesignal] click handler failed", e); }
        });
      }

      // Persist subscription id changes back to Supabase for server-side targeting.
      OneSignal.User.pushSubscription.addEventListener("change", () => { void syncSubscriptionId(); });

      await ensureNotificationChannels();
      return OneSignal;
    } catch (e) {
      console.warn("[onesignal] initialize failed", e);
      return null;
    }
  })();
  return initPromise;
}

/** Request the OS notification permission. Safe to call repeatedly. */
export async function requestPushPermission(): Promise<boolean> {
  const OneSignal = await initOneSignal();
  if (!OneSignal) return false;
  try {
    return await OneSignal.Notifications.requestPermission(true);
  } catch (e) {
    console.warn("[onesignal] requestPermission failed", e);
    return false;
  }
}

/** Associate the device's push subscription with an authenticated user. Idempotent. */
export async function loginPushUser(userId: string) {
  const OneSignal = await initOneSignal();
  if (!OneSignal) return;
  if (currentExternalId === userId) return;
  try {
    OneSignal.logout();
    OneSignal.login(userId);
    currentExternalId = userId;
    // Best-effort permission request on first login; ignored if already granted/denied.
    void OneSignal.Notifications.requestPermission(false).catch(() => {});
    await syncSubscriptionId();
  } catch (e) {
    console.warn("[onesignal] login failed", e);
  }
}

/** Detach the device from the current user (called on sign-out). */
export async function logoutPushUser() {
  const OneSignal = await initOneSignal();
  if (!OneSignal) return;
  try {
    // Best-effort cleanup: remove our push_subscriptions row for the local endpoint.
    if (currentExternalId) {
      const subId = await OneSignal.User.pushSubscription.getIdAsync().catch(() => null);
      if (subId) {
        await supabase.from("push_subscriptions")
          .delete()
          .eq("user_id", currentExternalId)
          .eq("endpoint", `onesignal:${subId}`);
      }
    }
    OneSignal.logout();
  } catch (e) {
    console.warn("[onesignal] logout failed", e);
  } finally {
    currentExternalId = null;
  }
}

/** Upsert the current OneSignal subscription id into `push_subscriptions` for this user. */
async function syncSubscriptionId() {
  const OneSignal = await initOneSignal();
  if (!OneSignal || !currentExternalId) return;
  try {
    const subId = await OneSignal.User.pushSubscription.getIdAsync();
    if (!subId) return;
    await supabase.from("push_subscriptions").upsert(
      {
        user_id: currentExternalId,
        endpoint: `onesignal:${subId}`,
        p256dh: "onesignal",
        auth: subId,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  } catch (e) {
    console.warn("[onesignal] syncSubscriptionId failed", e);
  }
}
