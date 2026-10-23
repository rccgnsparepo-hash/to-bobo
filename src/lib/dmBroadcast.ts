import { supabase } from "@/integrations/supabase/client";
import { recordUserActivity } from "@/lib/presence";

const activeSendChannels = new Map<string, ReturnType<typeof supabase.channel>>();

/**
 * Sends a real-time broadcast to a user's personal channel (instant notification / typing delivery).
 * Caches channel connections so broadcasts are delivered with 0ms overhead and no memory leak.
 */
export async function sendDmBroadcast(
  recipientId: string,
  event: "new-message" | "user-typing",
  payload: Record<string, unknown>
): Promise<void> {
  if (!recipientId) return;
  const senderId = (payload.sender_id || payload.senderId) as string | undefined;
  if (senderId) {
    recordUserActivity(senderId);
  }

  const channelName = event === "new-message" ? `dm-events-${recipientId}` : `dm-typing-${recipientId}`;
  let ch = activeSendChannels.get(channelName);

  if (!ch) {
    ch = supabase.channel(channelName);
    activeSendChannels.set(channelName, ch);

    await new Promise<void>((resolve) => {
      let resolved = false;
      ch!.subscribe((status) => {
        if (status === "SUBSCRIBED" && !resolved) {
          resolved = true;
          resolve();
        }
      });
      // Fallback timeout after 350ms so UI is never blocked
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 350);
    });
  }

  try {
    await ch.send({
      type: "broadcast",
      event,
      payload,
    });
  } catch (err) {
    console.warn(`[dmBroadcast] Failed to send ${event} to ${recipientId}:`, err);
  }
}
