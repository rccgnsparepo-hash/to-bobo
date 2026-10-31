// Native Android Push Notifications orchestrator.
// Configures Capacitor PushNotifications, Android channels, and LocalNotifications for the APK.
import { isNativePlatform } from "./platform";
import { ensureNotificationChannels } from "./channels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerNotchNotification } from "@/lib/notchNotification";

let pushInitialized = false;

export async function setupNativeAndroidPush(userId?: string) {
  if (!isNativePlatform() || pushInitialized) return;
  pushInitialized = true;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    // 1. Ensure high priority Android notification channels (Messages, News, System)
    await ensureNotificationChannels();

    // 2. Request push permissions from Android OS
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === "granted") {
      await PushNotifications.register();
    }

    // 3. Handle device registration token (FCM token)
    await PushNotifications.addListener("registration", async (token) => {
      console.log("[NativePush] Device registered with FCM token:", token.value);
      if (userId) {
        try {
          await supabase
            .from("profiles")
            .update({ fcm_token: token.value } as Record<string, unknown>)
            .eq("id", userId);
        } catch {
          /* optional column */
        }
      }
    });

    // 4. Handle registration error
    await PushNotifications.addListener("registrationError", (err) => {
      console.warn("[NativePush] Registration error:", err.error);
    });

    // 5. Handle foreground push notifications received on Android
    await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
      // Strict rule: Typing must NEVER be delivered through Android notifications
      if (
        notification.data?.kind === "typing" ||
        notification.title?.includes("is typing") ||
        notification.body?.includes("is typing")
      ) {
        return;
      }

      console.log("[NativePush] Push received in foreground:", notification);

      // Trigger high-visibility in-app notification banner
      triggerNotchNotification({
        kind: (notification.data?.kind as never) || "message",
        title: notification.title || "New notification",
        message: notification.body || "",
        url: notification.data?.url || "/",
      });

      // Show local Android notification
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: notification.title || "Flick",
              body: notification.body || "",
              id: Date.now() % 100000,
              schedule: { at: new Date(Date.now() + 100) },
              channelId: (notification.data?.channelId as string) || "messages",
              extra: notification.data,
            },
          ],
        });
      } catch (e) {
        console.warn("[NativePush] LocalNotification schedule error:", e);
      }
    });

    // 6. Handle notification click / tap action
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data;
      const targetUrl = data?.url || (data?.route as string);
      if (targetUrl) {
        window.dispatchEvent(
          new CustomEvent("flick:push-navigate", { detail: { path: targetUrl } })
        );
      }
    });
  } catch (err) {
    console.warn("[NativePush] PushNotifications initialization skipped or unsupported:", err);
  }
}
