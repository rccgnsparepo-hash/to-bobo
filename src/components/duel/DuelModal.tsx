import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Swords,
  Trophy,
  Zap,
  Timer,
  Flame,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Users,
  Radio,
  Share2,
  MessageSquare,
  AlertCircle,
  WifiOff,
  Clock,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { type TopFlicker } from "@/lib/topFlickers";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";
import { fireAuthConfetti } from "@/lib/confetti";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type RealtimeChannel } from "@supabase/supabase-js";
import { useOnlinePresence } from "@/lib/presence";
import { sendDmBroadcast, type DuelResponsePayload } from "@/lib/dmBroadcast";
import { useNavigate } from "react-router-dom";

interface DuelModalProps {
  open: boolean;
  onClose: () => void;
  opponent: TopFlicker | null;
  customRoomId?: string;
  autoStartCountdown?: boolean;
}

type DuelState =
  | "ready"
  | "inviting"
  | "declined"
  | "timeout"
  | "opponent_offline"
  | "countdown"
  | "playing"
  | "result";

export function DuelModal({
  open,
  onClose,
  opponent,
  customRoomId,
  autoStartCountdown = false,
}: DuelModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isUserOnline } = useOnlinePresence();

  const [gameState, setGameState] = useState<DuelState>("ready");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(5.0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [onlineCount, setOnlineCount] = useState(1);
  const [combo, setCombo] = useState(0);
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState(20);
  const [isChallenged, setIsChallenged] = useState(false);
  const [personalBest, setPersonalBest] = useState(() => {
    try {
      return parseInt(localStorage.getItem("flick:duel_pb") || "0", 10);
    } catch {
      return 0;
    }
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inviteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const playerScoreRef = useRef<number>(0);

  const roomId = customRoomId || (user && opponent ? `duel_${[user.id, opponent.id].sort().join("_").slice(0, 24)}` : "arena");

  // Sync ref with state for realtime callbacks
  useEffect(() => {
    playerScoreRef.current = playerScore;
  }, [playerScore]);

  // Clean all timers
  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (inviteTimerRef.current) {
      clearInterval(inviteTimerRef.current);
      inviteTimerRef.current = null;
    }
  }, []);

  // Supabase Realtime channel setup for Arena presence & live duel events
  useEffect(() => {
    if (!open) {
      clearAllTimers();
      setGameState("ready");
      setPlayerScore(0);
      setOpponentScore(0);
      setTimeLeft(5.0);
      setCombo(0);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel(`flick:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "live_tap" }, (payload) => {
        // STRICT: Real taps from real human opponent only. No bot simulation!
        if (payload?.payload?.score !== undefined) {
          setOpponentScore(payload.payload.score);
        }
      })
      .on("broadcast", { event: "duel_start_sync" }, () => {
        if (gameState === "inviting") {
          startCountdown();
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setOnlineCount(Math.max(1, count));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && profile) {
          channel.track({
            user_id: profile.id,
            handle: profile.handle,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    // Listen for duel responses when inviting an opponent
    const handleDuelResponse = (e: Event) => {
      const detail = (e as CustomEvent<DuelResponsePayload>).detail;
      if (!detail) return;

      if (detail.accepted) {
        toast.success(`⚔️ @${opponent?.handle || "Opponent"} accepted the duel!`);
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "duel_start_sync",
            payload: { timestamp: Date.now() },
          });
        }
        startCountdown();
      } else {
        clearAllTimers();
        setGameState("declined");
        toast.error(`@[opponent?.handle] declined the duel.`);
      }
    };

    window.addEventListener("flick:duel-response-received", handleDuelResponse);

    if (autoStartCountdown) {
      startCountdown();
    }

    return () => {
      clearAllTimers();
      window.removeEventListener("flick:duel-response-received", handleDuelResponse);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [open, roomId, opponent, profile, clearAllTimers, autoStartCountdown]);

  // Initiate Live Challenge to opponent
  const initiateChallenge = () => {
    if (!opponent || !user) return;

    // 1. Check if opponent is online
    const isOnline = isUserOnline(opponent.id);
    if (!isOnline) {
      setGameState("opponent_offline");
      return;
    }

    // 2. Set state to inviting and broadcast duel invite
    setGameState("inviting");
    setInviteSecondsLeft(20);
    triggerLightHaptic();

    void sendDmBroadcast(opponent.id, "duel-invite", {
      challengerId: user.id,
      challengerName: profile?.display_name || "Challenger",
      challengerHandle: profile?.handle || "user",
      challengerAvatar: profile?.avatar_url,
      duelId: roomId,
      timestamp: new Date().toISOString(),
    });

    toast.info(`Sent live challenge to @${opponent.handle}. Waiting for answer...`);

    // 20-second timeout
    let remaining = 20;
    inviteTimerRef.current = setInterval(() => {
      remaining -= 1;
      setInviteSecondsLeft(remaining);
      if (remaining <= 0) {
        clearAllTimers();
        setGameState("timeout");
      }
    }, 1000);
  };

  // Start Countdown smoothly
  const startCountdown = () => {
    clearAllTimers();
    setGameState("countdown");
    setCountdown(3);
    setPlayerScore(0);
    setOpponentScore(0);
    setTimeLeft(5.0);
    setCombo(0);
    triggerLightHaptic();

    let cur = 3;
    countdownTimerRef.current = setInterval(() => {
      cur -= 1;
      if (cur <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        beginLiveDuel();
      } else {
        setCountdown(cur);
        triggerLightHaptic();
      }
    }, 800);
  };

  // Begin the 5.0 second Duel
  const beginLiveDuel = () => {
    setGameState("playing");
    setPlayerScore(0);
    setOpponentScore(0);
    setTimeLeft(5.0);
    triggerSuccessHaptic();

    startTimeRef.current = Date.now();

    // 1. Stable, non-glitchy 100ms clock interval for timer
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, 5.0 - elapsed);
      setTimeLeft(parseFloat(remaining.toFixed(1)));

      if (remaining <= 0) {
        clearAllTimers();
        finishLiveDuel();
      }
    }, 100);

    // CRITICAL FIX: NO COMPUTER BOT SIMULATION!
    // Opponent taps ONLY increment when real opponent taps via supabase.channel broadcast.
  };

  // Handle Player Tap (Optimized & Non-Glitchy)
  const handlePlayerTap = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (gameState !== "playing") return;

    const newScore = playerScoreRef.current + 1;
    playerScoreRef.current = newScore;
    setPlayerScore(newScore);

    // Dynamic combo counter
    setCombo((c) => c + 1);

    // Broadcast real-time tap to Supabase Realtime channel
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "live_tap",
        payload: { score: newScore, userId: profile?.id },
      });
    }

    // Light tactile feedback
    triggerLightHaptic();

    // Throttled sound synthesis (max once every 120ms to prevent audio clipping)
    const now = Date.now();
    if (now - lastSoundTimeRef.current > 120) {
      lastSoundTimeRef.current = now;
      try {
        playSound("message_sent");
      } catch {}
    }
  };

  // Finish Duel
  const finishLiveDuel = () => {
    setGameState("result");
    const finalScore = playerScoreRef.current;
    if (finalScore > personalBest) {
      setPersonalBest(finalScore);
      try {
        localStorage.setItem("flick:duel_pb", finalScore.toString());
      } catch {}
    }

    triggerSuccessHaptic();
    try {
      playSound("auth_success");
    } catch {}

    if (finalScore >= opponentScore) {
      fireAuthConfetti();
    }
  };

  const sendDmChallengeNotice = () => {
    if (!opponent) return;
    onClose();
    navigate(`/messages/${opponent.id}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl select-none">
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            className="w-full max-w-md rounded-3xl bg-card border-2 border-border/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col max-h-[92vh]"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-secondary/30 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center">
                  <Swords className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h2 className="font-display font-black text-sm tracking-wide text-foreground uppercase flex items-center gap-1.5">
                    <span>Live Tap Arena</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </h2>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400" />
                    <span>Realtime Peer-to-Peer • No Bots</span>
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content area */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col justify-between">
              {/* Opponent VS Player Banner */}
              <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-secondary/40 border border-border/50 relative overflow-hidden">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar url={profile?.avatar_url} name={profile?.display_name} size={44} ring />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-snap uppercase tracking-wider block">You</span>
                    <span className="text-xs font-bold truncate block">{profile?.display_name || "Challenger"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">PB: {personalBest} taps</span>
                  </div>
                </div>

                <div className="flex flex-col items-center shrink-0 px-2">
                  <span className="text-sm font-black text-red-500 italic">VS</span>
                  <Swords className="w-4 h-4 text-muted-foreground/60" />
                </div>

                <div className="flex items-center gap-3 min-w-0 text-right justify-end">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Opponent</span>
                    <span className="text-xs font-bold truncate block">{opponent?.display_name || "Opponent"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">@{opponent?.handle || "peer"}</span>
                  </div>
                  <Avatar url={opponent?.avatar_url} name={opponent?.display_name} size={44} ring />
                </div>
              </div>

              {/* Game View States */}
              <div className="my-6 flex-1 flex flex-col items-center justify-center min-h-[200px]">
                {/* 1. READY STATE */}
                {gameState === "ready" && (
                  <div className="text-center space-y-4 max-w-xs">
                    <div className="w-16 h-16 rounded-3xl bg-red-500/10 border-2 border-red-500/30 text-red-500 mx-auto grid place-items-center shadow-lg">
                      <Swords className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-extrabold text-foreground">
                        Ready to Duel?
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Tap as fast as possible in 5.0 seconds. Both players must accept in real-time. Zero computer play!
                      </p>
                    </div>

                    <button
                      onClick={initiateChallenge}
                      className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm tracking-wide shadow-xl shadow-red-600/30 active:scale-95 transition flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Challenge @{opponent?.handle} Live ⚔️</span>
                    </button>
                  </div>
                )}

                {/* 2. OPPONENT OFFLINE STATE */}
                {gameState === "opponent_offline" && (
                  <div className="text-center space-y-3 max-w-xs">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto grid place-items-center">
                      <WifiOff className="w-7 h-7" />
                    </div>
                    <h3 className="font-display text-base font-extrabold text-foreground">
                      @{opponent?.handle} is Currently Offline
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Live Duels are strictly peer-to-peer and require the user to be active in the app. Computer bot play is completely disabled.
                    </p>
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={sendDmChallengeNotice}
                        className="w-full py-2.5 rounded-xl bg-snap text-snap-foreground font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send Challenge Invite via DM</span>
                      </button>
                      <button
                        onClick={() => setGameState("ready")}
                        className="w-full py-2 text-xs text-muted-foreground hover:text-foreground font-semibold"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. INVITING / WAITING FOR ACCEPTANCE */}
                {gameState === "inviting" && (
                  <div className="text-center space-y-4 max-w-xs">
                    <div className="relative w-16 h-16 mx-auto grid place-items-center">
                      <span className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping" />
                      <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-500 grid place-items-center">
                        <Clock className="w-7 h-7 animate-spin" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        Waiting for @{opponent?.handle}…
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Checking if user answers YES or NO in realtime. ({inviteSecondsLeft}s remaining)
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        clearAllTimers();
                        setGameState("ready");
                      }}
                      className="py-2 px-4 rounded-xl bg-secondary text-xs text-muted-foreground hover:text-foreground font-semibold"
                    >
                      Cancel Challenge
                    </button>
                  </div>
                )}

                {/* 4. DECLINED STATE */}
                {gameState === "declined" && (
                  <div className="text-center space-y-3 max-w-xs">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-zinc-400 mx-auto grid place-items-center">
                      <X className="w-7 h-7" />
                    </div>
                    <h3 className="font-display text-base font-extrabold text-foreground">
                      Challenge Declined
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      @{opponent?.handle} declined the duel invitation.
                    </p>
                    <button
                      onClick={() => setGameState("ready")}
                      className="mt-2 py-2.5 px-5 rounded-xl bg-secondary text-xs font-bold hover:bg-secondary/70 transition"
                    >
                      Back
                    </button>
                  </div>
                )}

                {/* 5. TIMEOUT STATE */}
                {gameState === "timeout" && (
                  <div className="text-center space-y-3 max-w-xs">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto grid place-items-center">
                      <AlertCircle className="w-7 h-7" />
                    </div>
                    <h3 className="font-display text-base font-extrabold text-foreground">
                      No Response Received
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      @{opponent?.handle} didn&apos;t respond in time. You can send them a direct message challenge!
                    </p>
                    <button
                      onClick={sendDmChallengeNotice}
                      className="py-2.5 px-4 rounded-xl bg-snap text-snap-foreground font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Send Challenge in Chat</span>
                    </button>
                  </div>
                )}

                {/* 6. COUNTDOWN STATE */}
                {gameState === "countdown" && (
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="text-center"
                  >
                    <span className="font-display text-7xl font-black text-snap drop-shadow-[0_0_30px_rgba(180,255,80,0.6)]">
                      {countdown}
                    </span>
                    <p className="text-xs uppercase font-extrabold tracking-widest text-muted-foreground mt-2">
                      Get Ready to Tap!
                    </p>
                  </motion.div>
                )}

                {/* 7. LIVE PLAYING STATE */}
                {gameState === "playing" && (
                  <div className="w-full flex flex-col items-center space-y-4">
                    {/* Live Clock & Scores */}
                    <div className="w-full flex items-center justify-between px-4 py-2 rounded-2xl bg-secondary/50 border border-border">
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold text-snap">You</span>
                        <div className="font-display text-3xl font-black text-foreground">{playerScore}</div>
                      </div>

                      <div className="text-center">
                        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-mono font-black text-base border border-red-500/40">
                          <Timer className="w-4 h-4 animate-spin" />
                          <span>{timeLeft.toFixed(1)}s</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-red-400">@{opponent?.handle}</span>
                        <div className="font-display text-3xl font-black text-foreground">{opponentScore}</div>
                      </div>
                    </div>

                    {/* Big Rapid Tap Button */}
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={handlePlayerTap}
                      onTouchStart={handlePlayerTap}
                      style={{ touchAction: "manipulation" }}
                      className="w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 text-white font-display text-3xl font-black shadow-[0_0_50px_rgba(239,68,68,0.5)] active:shadow-[0_0_80px_rgba(239,68,68,0.8)] border-4 border-white/20 flex flex-col items-center justify-center gap-1 cursor-pointer select-none"
                    >
                      <Zap className="w-10 h-10 fill-current animate-bounce" />
                      <span>TAP!</span>
                      <span className="text-[11px] font-mono tracking-wider opacity-85">Combo x{combo}</span>
                    </motion.button>
                  </div>
                )}

                {/* 8. RESULT STATE */}
                {gameState === "result" && (
                  <div className="w-full text-center space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30 text-xs font-black tracking-wider uppercase">
                      <Trophy className="w-4 h-4" />
                      <span>Match Finished</span>
                    </div>

                    <div className="font-display text-3xl sm:text-4xl font-black text-foreground">
                      {playerScore > opponentScore ? (
                        <span className="text-emerald-400">VICTORY! 🏆</span>
                      ) : playerScore === opponentScore ? (
                        <span className="text-amber-400">DRAW! ⚔️</span>
                      ) : (
                        <span className="text-rose-500">DEFEATED! ⚔️</span>
                      )}
                    </div>

                    {/* Final Scores comparison */}
                    <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                      <div className="p-3 rounded-2xl bg-secondary/80 border border-border">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Your Score</span>
                        <div className="text-2xl font-black text-snap">{playerScore}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-secondary/80 border border-border">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">@{opponent?.handle}</span>
                        <div className="text-2xl font-black text-red-400">{opponentScore}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={initiateChallenge}
                        className="py-3 px-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-red-600/30"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Rematch</span>
                      </button>

                      <button
                        onClick={onClose}
                        className="py-3 px-5 rounded-2xl bg-secondary hover:bg-secondary/70 text-foreground font-bold text-xs transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer info */}
              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Real human opponent: {opponent?.display_name}</span>
                </span>
                <span className="font-mono text-snap">Personal Best: {personalBest}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
