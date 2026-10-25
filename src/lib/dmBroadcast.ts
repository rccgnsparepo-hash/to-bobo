import { supabase } from "@/integrations/supabase/client";
import { recordUserActivity } from "@/lib/presence";

type RealtimeChannel = ReturnType<typeof supabase.channel>;
const activeSendChannels = new Map<string, RealtimeChannel>();

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
 * Caches channel connections and automatically reconnects if channel state dropped.
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

  const channelName = `dm-events-${recipientId}`;
  let ch = activeSendChannels.get(channelName);

  // If channel is missing or closed/errored, rebuild and subscribe
  // @ts-expect-error Supabase channel state string
  const isJoined = ch && (ch.state === "joined" || ch.state === "joining");

  if (!ch || !isJoined) {
    if (ch) {
      try {
        void supabase.removeChannel(ch);
      } catch {}
      activeSendChannels.delete(channelName);
    }

    ch = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });
    activeSendChannels.set(channelName, ch);

    await new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      ch!.subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          done();
        }
      });

      // Quick timeout fallback so sending UI is never delayed
      setTimeout(done, 400);
    });
  }

  try {
    await ch.send({
      type: "broadcast",
      event,
      payload,
    });
  } catch (err) {
    console.warn(`[dmBroadcast] Broadcast send error for ${event} to ${recipientId}:`, err);
  }
}
