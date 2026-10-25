import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Check, Flame, Zap } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { sendDmBroadcast, type DuelInvitePayload } from "@/lib/dmBroadcast";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";
import { DuelModal } from "./DuelModal";
import { type TopFlicker } from "@/lib/topFlickers";

export function DuelChallengeReceiver() {
  const { user } = useAuth();
  const [incomingInvite, setIncomingInvite] = useState<DuelInvitePayload | null>(null);
  const [activeDuelOpponent, setActiveDuelOpponent] = useState<TopFlicker | null>(null);
  const [activeDuelOpen, setActiveDuelOpen] = useState(false);
  const [activeDuelRoomId, setActiveDuelRoomId] = useState<string | null>(null);

  useEffect(() => {
    const handleInvite = (e: Event) => {
      const detail = (e as CustomEvent<DuelInvitePayload>).detail;
      if (!detail || !detail.challengerId || detail.challengerId === user?.id) return;

      // Play challenge notification sound & haptic
      try {
        playSound("notification_chime");
      } catch {}
      triggerLightHaptic();

      setIncomingInvite(detail);
    };

    window.addEventListener("flick:duel-invite-received", handleInvite);
    return () => {
      window.removeEventListener("flick:duel-invite-received", handleInvite);
    };
  }, [user?.id]);

  const handleAccept = () => {
    if (!incomingInvite || !user) return;
    triggerSuccessHaptic();

    // Broadcast positive response to challenger
    void sendDmBroadcast(incomingInvite.challengerId, "duel-response", {
      duelId: incomingInvite.duelId,
      challengerId: incomingInvite.challengerId,
      opponentId: user.id,
      accepted: true,
    });

    const opponentFlicker: TopFlicker = {
      id: incomingInvite.challengerId,
      handle: incomingInvite.challengerHandle,
      display_name: incomingInvite.challengerName,
      avatar_url: incomingInvite.challengerAvatar || null,
      rank: 1,
      engagementScore: 500,
      flicksCount: 1,
      likesReceived: 1,
      badgeLabel: "Challenger",
      haloColor: "rgba(239, 68, 68, 0.6)",
    };

    setActiveDuelRoomId(incomingInvite.duelId);
    setActiveDuelOpponent(opponentFlicker);
    setActiveDuelOpen(true);
    setIncomingInvite(null);
  };

  const handleDecline = () => {
    if (!incomingInvite || !user) return;
    triggerLightHaptic();

    // Broadcast decline back to challenger
    void sendDmBroadcast(incomingInvite.challengerId, "duel-response", {
      duelId: incomingInvite.duelId,
      challengerId: incomingInvite.challengerId,
      opponentId: user.id,
      accepted: false,
      reason: "Declined challenge",
    });

    setIncomingInvite(null);
  };

  return (
    <>
      {/* Floating Duel Invitation Modal */}
      <AnimatePresence>
        {incomingInvite && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm rounded-3xl bg-[#12141f] border-2 border-red-500/50 p-6 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Glowing decorative background */}
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-red-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 mx-auto grid place-items-center mb-3">
                  <Swords className="w-7 h-7 animate-pulse" />
                </div>

                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-extrabold tracking-wider uppercase mb-2">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Live Duel Challenge!</span>
                </div>

                <h3 className="font-display text-xl font-black text-white">
                  Incoming Challenge!
                </h3>

                <div className="my-4 flex items-center justify-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <Avatar
                    url={incomingInvite.challengerAvatar}
                    name={incomingInvite.challengerName}
                    size={48}
                    ring
                  />
                  <div className="text-left min-w-0">
                    <div className="font-bold text-sm text-white truncate">
                      {incomingInvite.challengerName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      @{incomingInvite.challengerHandle}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                  challenged you to a live 5.0-second speed-tapping duel. No bots—real taps only!
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDecline}
                    className="py-3 px-4 rounded-2xl bg-secondary/80 hover:bg-secondary text-zinc-300 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Decline</span>
                  </button>

                  <button
                    onClick={handleAccept}
                    className="py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition active:scale-95 shadow-lg shadow-red-600/40 flex items-center justify-center gap-1.5"
                  >
                    <Swords className="w-4 h-4" />
                    <span>Accept ⚔️</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Render DuelModal for accepted duel */}
      {activeDuelOpponent && (
        <DuelModal
          open={activeDuelOpen}
          onClose={() => {
            setActiveDuelOpen(false);
            setActiveDuelOpponent(null);
            setActiveDuelRoomId(null);
          }}
          opponent={activeDuelOpponent}
          customRoomId={activeDuelRoomId || undefined}
          autoStartCountdown={true}
        />
      )}
    </>
  );
}
