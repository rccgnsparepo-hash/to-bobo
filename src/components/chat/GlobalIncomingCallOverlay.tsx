import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { callService, type CallSignal } from "@/lib/callService";
import { ActiveCallModal } from "@/components/chat/ActiveCallModal";
import { triggerSuccessHaptic, triggerLightHaptic } from "@/lib/haptics";

export function GlobalIncomingCallOverlay() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null);
  const [activeCallModal, setActiveCallModal] = useState<{
    open: boolean;
    peer: { id: string; handle: string; display_name: string; avatar_url: string | null };
    callType: "audio" | "video";
    callId: string;
    isInitiator: boolean;
  } | null>(null);

  const timeoutTimerRef = useRef<number | null>(null);

  // 1. Subscribe to incoming calls on user's personal channel
  useEffect(() => {
    if (!user) return;

    const channelName = `dm-events-${user.id}`;
    const ch = supabase
      .channel(channelName)
      .on("broadcast", { event: "incoming-call" }, ({ payload }) => {
        const signal = payload as CallSignal;
        if (!signal || signal.callerId === user.id) return;

        // Verify call is recent (< 30 seconds old)
        if (Date.now() - signal.createdAt > 30000) return;

        // Play Optimus Prime incoming ringtone
        callService.playIncomingRingtone();
        setIncomingCall(signal);

        // Auto-dismiss after 35s if not answered
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = window.setTimeout(() => {
          setIncomingCall((current) => {
            if (current?.callId === signal.callId) {
              void callService.declineCall(signal, "timeout");
              return null;
            }
            return current;
          });
        }, 35000);
      })
      .on("broadcast", { event: "call-ended" }, ({ payload }) => {
        const p = payload as { callId: string };
        setIncomingCall((current) => (current?.callId === p.callId ? null : current));
        callService.stopRingtone();
      })
      .on("broadcast", { event: "call-declined" }, ({ payload }) => {
        const p = payload as { callId: string };
        setIncomingCall((current) => (current?.callId === p.callId ? null : current));
        callService.stopRingtone();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [user]);

  const handleAccept = async () => {
    if (!incomingCall) return;
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    triggerSuccessHaptic();

    const signal = incomingCall;
    setIncomingCall(null);
    await callService.answerCall(signal);

    // Launch active call modal in connected state
    setActiveCallModal({
      open: true,
      peer: {
        id: signal.callerId,
        display_name: signal.callerName,
        handle: signal.callerHandle,
        avatar_url: signal.callerAvatar || null,
      },
      callType: signal.callType,
      callId: signal.callId,
      isInitiator: false,
    });
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    triggerLightHaptic();

    const signal = incomingCall;
    setIncomingCall(null);
    await callService.declineCall(signal, "declined");
  };

  return (
    <>
      {/* High-Priority Incoming Call Modal Pop-Up */}
      <AnimatePresence>
        {incomingCall && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-sm rounded-[32px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-white/15 p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
            >
              {/* Animated Background Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Pulsing Avatar Rings */}
              <div className="relative mb-5 mt-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ping duration-1000" />
                <span className="absolute -inset-2 rounded-full border border-emerald-500/40 animate-pulse" />
                <Avatar
                  url={incomingCall.callerAvatar}
                  name={incomingCall.callerName}
                  size={88}
                  ring
                />
              </div>

              {/* Caller Info */}
              <div className="space-y-1 mb-6">
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  {incomingCall.callerName}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  @{incomingCall.callerHandle}
                </p>
                <div className="pt-2 flex items-center justify-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {incomingCall.callType === "video" ? (
                      <Video className="w-3.5 h-3.5 animate-pulse" />
                    ) : (
                      <Phone className="w-3.5 h-3.5 animate-pulse" />
                    )}
                    <span>Incoming {incomingCall.callType === "video" ? "Video" : "Voice"} Call…</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons: Decline (Red) & Accept (Green) */}
              <div className="flex items-center justify-center gap-6 w-full pt-2">
                {/* Decline */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDecline}
                    className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white grid place-items-center shadow-lg shadow-rose-600/30 transition cursor-pointer"
                    aria-label="Decline Call"
                  >
                    <PhoneOff className="w-7 h-7" />
                  </button>
                  <span className="text-[11px] font-bold text-zinc-400">Decline</span>
                </div>

                {/* Accept */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAccept}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white grid place-items-center shadow-lg shadow-emerald-500/30 transition cursor-pointer animate-bounce"
                    aria-label="Accept Call"
                  >
                    {incomingCall.callType === "video" ? (
                      <Video className="w-7 h-7" />
                    ) : (
                      <Phone className="w-7 h-7" />
                    )}
                  </button>
                  <span className="text-[11px] font-bold text-emerald-400">Accept</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Connected Active Call Modal */}
      {activeCallModal && (
        <ActiveCallModal
          open={activeCallModal.open}
          peer={activeCallModal.peer}
          callType={activeCallModal.callType}
          callId={activeCallModal.callId}
          isInitiator={activeCallModal.isInitiator}
          onClose={(durSec) => {
            if (activeCallModal.callId) {
              void callService.endCall(activeCallModal.callId, activeCallModal.peer.id, durSec || 0);
            }
            setActiveCallModal(null);
          }}
        />
      )}
    </>
  );
}
