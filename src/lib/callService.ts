/**
 * Real-Time Call Service for Flick
 * Provides WebRTC calling signaling with instant cross-app push and popups
 * anywhere across mobile data and WiFi.
 */

import { supabase } from "@/integrations/supabase/client";
import { sendDmBroadcast } from "@/lib/dmBroadcast";
import { notificationAudio } from "@/lib/notificationAudio";

export type CallType = "audio" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "ended" | "busy";

export interface CallSignal {
  callId: string;
  callerId: string;
  callerName: string;
  callerHandle: string;
  callerAvatar?: string | null;
  recipientId: string;
  callType: CallType;
  status: CallStatus;
  createdAt: number;
}

class CallService {
  private activeCall: CallSignal | null = null;
  private ringAudio: HTMLAudioElement | null = null;

  public getActiveCall(): CallSignal | null {
    return this.activeCall;
  }

  /**
   * Start an outgoing call to any user
   */
  public async initiateCall(
    caller: { id: string; name: string; handle: string; avatarUrl?: string | null },
    recipient: { id: string; name: string; handle: string; avatarUrl?: string | null },
    callType: CallType
  ): Promise<CallSignal> {
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const signal: CallSignal = {
      callId,
      callerId: caller.id,
      callerName: caller.name,
      callerHandle: caller.handle,
      callerAvatar: caller.avatarUrl,
      recipientId: recipient.id,
      callType,
      status: "ringing",
      createdAt: Date.now(),
    };

    this.activeCall = signal;

    // 1. Send instant real-time broadcast to recipient's personal dm-events channel
    await sendDmBroadcast(recipient.id, "incoming-call", {
      ...signal,
    });

    // 2. Also send to dedicated call channel
    const callCh = supabase.channel(`space:call:${callId}`);
    await callCh.send({
      type: "broadcast",
      event: "call:signal",
      payload: signal,
    });

    // Notify local caller UI
    window.dispatchEvent(new CustomEvent("flick:call-started", { detail: signal }));

    return signal;
  }

  /**
   * Recipient answers the incoming call
   */
  public async answerCall(signal: CallSignal): Promise<void> {
    this.stopRingtone();
    signal.status = "accepted";
    this.activeCall = signal;

    // 1. Notify caller on personal channel
    await sendDmBroadcast(signal.callerId, "call-accepted", {
      callId: signal.callId,
      peerId: signal.recipientId,
    });

    // 2. Notify on call channel
    const callCh = supabase.channel(`space:call:${signal.callId}`);
    await callCh.send({
      type: "broadcast",
      event: "call:accepted",
      payload: { callId: signal.callId },
    });

    window.dispatchEvent(new CustomEvent("flick:call-accepted", { detail: signal }));
  }

  /**
   * Recipient or caller declines the incoming call
   */
  public async declineCall(signal: CallSignal, reason = "declined"): Promise<void> {
    this.stopRingtone();
    signal.status = "declined";
    if (this.activeCall?.callId === signal.callId) {
      this.activeCall = null;
    }

    // 1. Notify caller on personal channel
    await sendDmBroadcast(signal.callerId, "call-declined", {
      callId: signal.callId,
      reason,
    });

    // 2. Notify on call channel
    const callCh = supabase.channel(`space:call:${signal.callId}`);
    await callCh.send({
      type: "broadcast",
      event: "call:declined",
      payload: { callId: signal.callId, reason },
    });

    window.dispatchEvent(new CustomEvent("flick:call-declined", { detail: signal }));
  }

  /**
   * Ends an active call from either party
   */
  public async endCall(callId: string, peerId: string, durationSec = 0): Promise<void> {
    this.stopRingtone();
    this.activeCall = null;

    if (peerId) {
      await sendDmBroadcast(peerId, "call-ended", { callId, durationSec });
    }

    const callCh = supabase.channel(`space:call:${callId}`);
    await callCh.send({
      type: "broadcast",
      event: "call:ended",
      payload: { callId, durationSec },
    });

    window.dispatchEvent(new CustomEvent("flick:call-ended", { detail: { callId, durationSec } }));
  }

  /**
   * Play Optimus Prime incoming call ringtone
   */
  public playIncomingRingtone(): void {
    if (typeof window === "undefined") return;
    try {
      this.stopRingtone();
      // Play Optimus Prime "You have a new message" / calling voice
      void notificationAudio.playOptimusVoice("message", 0.95);

      // Play vibrating pulse pattern if device supports it
      if ("vibrate" in navigator) {
        navigator.vibrate([400, 200, 400, 200, 400]);
      }
    } catch {}
  }

  public stopRingtone(): void {
    if (this.ringAudio) {
      try {
        this.ringAudio.pause();
        this.ringAudio.currentTime = 0;
      } catch {}
      this.ringAudio = null;
    }
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }
}

export const callService = new CallService();
