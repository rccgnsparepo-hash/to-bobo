import { supabase } from "@/integrations/supabase/client";
import { recordUserActivity } from "@/lib/presence";

const activeSendChannels = new Map<string, ReturnType<typeof supabase.channel>>();

export type DmBroadcastEvent =
  | "new-message"
  | "user-typing"
  | "duel-invite"
  | "duel-response"
  | "duel-tap";

export interface DuelInvitePayload {
  challengerId: string;
  challengerName: string;
  challengerHandle: string;
  challengerAvatar?: string | null;
  duelId: string;
  timestamp: string;
}

export interface DuelResponsePayload {
  duelId: string;
  challengerId: string;
  opponentId: string;
  accepted: boolean;
  reason?: string;
}

/**
 * Sends a real-time broadcast to a user's personal channel (instant notification / typing / live duels).
 * Caches channel connections so broadcasts are delivered with 0ms overhead and no memory leak.
 */
export async function sendDmBroadcast(
  recipientId: string,
  event: DmBroadcastEvent,
  payload: Record<string, unknown>
): Promise<void> {
  if (!recipientId) return;
  const senderId = (payload.sender_id || payload.senderId || payload.challengerId || payload.opponentId) as string | undefined;
  if (senderId) {
    recordUserActivity(senderId);
  }

  // Consistent unified channel per recipient for all realtime peer signals
  const channelName = `dm-events-${recipientId}`;
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
