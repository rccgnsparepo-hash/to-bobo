import { useState, useRef, useEffect } from "react";
import {
  Users,
  Heart,
  Flame,
  Send,
  X,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
  MessageCircle,
  Radio,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { WebRtcEngine } from "@/lib/space/webRtcEngine";
import { SpaceService } from "@/lib/space/spaceService";
import type { LiveBroadcastSession, LiveChatMessage, LiveReaction } from "@/lib/space/types";

interface Props {
  session: LiveBroadcastSession;
  onClose: () => void;
}

export function LiveWatchView({ session, onClose }: Props) {
  const { user, profile } = useAuth();
  const [viewerCount, setViewerCount] = useState(session.viewerCount || 1);
  const [likesCount, setLikesCount] = useState(session.likesCount || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [floatingReactions, setFloatingReactions] = useState<LiveReaction[]>([]);

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const rtcEngineRef = useRef<WebRtcEngine | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    // 1. Initialize WebRTC receiver
    const engine = new WebRtcEngine(
      user.id,
      (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
      },
      (state) => {
        if (state === "disconnected" || state === "failed") {
          toast("Reconnecting to live broadcast…");
        }
      }
    );
    rtcEngineRef.current = engine;

    const chName = `space:live:${session.id}`;
    const rtcChannelName = `space:live:${session.id}:rtc`;
    engine.initSignaling(rtcChannelName, false);

    // Clean up any existing channel with the same topic to avoid re-subscribing conflicts
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${chName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    // 2. Real-time broadcast channel for comments, reactions & presence
    const ch = supabase.channel(chName, {
      config: { broadcast: { self: true }, presence: { key: user.id } },
    });

    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      setChatMessages((prev) => [...prev.slice(-30), payload]);
    })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        setLikesCount((prev) => prev + 1);
        setFloatingReactions((prev) => [...prev.slice(-15), payload]);
      })
      .on("broadcast", { event: "live:status_changed" }, ({ payload }) => {
        if (payload.status === "ended") {
          toast("This live broadcast has ended.");
          onClose();
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        const count = Math.max(1, Object.keys(state).length);
        setViewerCount(count);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({
            userId: user.id,
            name: profile?.display_name || "Viewer",
            isHost: false,
            onlineAt: Date.now(),
          });
        }
      });

    channelRef.current = ch;

    return () => {
      if (rtcEngineRef.current) {
        rtcEngineRef.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [session.id, user?.id]);

  const handleSendComment = () => {
    if (!chatInput.trim() || !channelRef.current || !user) return;
    const msg: LiveChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sessionId: session.id,
      userId: user.id,
      userName: profile?.display_name || "Viewer",
      userHandle: profile?.handle || "viewer",
      userAvatar: profile?.avatar_url,
      message: chatInput.trim(),
      timestamp: Date.now(),
      isHost: false,
    };
    void channelRef.current.send({
      type: "broadcast",
      event: "chat",
      payload: msg,
    });
    setChatInput("");
  };

  const handleSendReaction = (emoji: string) => {
    void triggerLightHaptic();
    if (!channelRef.current || !user) return;
    const reaction: LiveReaction = {
      id: `react_${Date.now()}_${Math.random()}`,
      emoji,
      userId: user.id,
      timestamp: Date.now(),
    };
    void channelRef.current.send({
      type: "broadcast",
      event: "reaction",
      payload: reaction,
    });
    SpaceService.incrementLiveLikes(session.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden">
      {/* Remote Video Stream Stage */}
      <video
        ref={remoteVideoRef}
        playsInline
        autoPlay
        muted={isMuted}
        className="w-full h-full object-cover"
      />

      {/* Dark Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none" />

      {/* Top Viewer HUD */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4">
        {/* Host Profile Info */}
        <div className="flex items-center gap-2.5 bg-black/50 backdrop-blur-md p-1.5 pr-4 rounded-full border border-white/10">
          <Avatar url={session.hostAvatar} name={session.hostName} size={36} ring />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate leading-tight">
              {session.hostName}
            </div>
            <div className="text-[10px] text-zinc-300 truncate">@{session.hostHandle}</div>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[10px] tracking-wider">
            LIVE
          </span>
        </div>

        {/* Audience Count, Audio Mute & Close */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white font-mono text-xs flex items-center gap-1.5 border border-white/10">
            <Users className="w-3.5 h-3.5 text-zinc-300" />
            <span>{viewerCount}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white grid place-items-center hover:bg-black/80 transition active:scale-95"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white grid place-items-center hover:bg-black/80 transition active:scale-95"
            title="Leave Broadcast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Reaction Animation Stream */}
      <div className="absolute bottom-28 right-4 z-20 pointer-events-none flex flex-col items-center gap-2">
        <AnimatePresence>
          {floatingReactions.slice(-8).map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -100, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="text-2xl"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Lower Viewer HUD: Comments & Floating Reaction Triggers */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-4 flex flex-col gap-3">
        {/* Chat Feed */}
        <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1.5 mask-gradient-b">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className="inline-flex items-start gap-1.5 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md text-xs text-white max-w-[85%] border border-white/10"
            >
              <span className={`font-bold ${msg.isHost ? "text-amber-400" : "text-rose-400"}`}>
                @{msg.userHandle}:
              </span>
              <span className="text-zinc-100">{msg.message}</span>
            </div>
          ))}
        </div>

        {/* Comment Box & Quick Reaction Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendComment();
            }}
            placeholder="Add a comment…"
            className="flex-1 bg-black/50 border border-white/20 rounded-full px-4 py-2 text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          <button
            type="button"
            onClick={handleSendComment}
            className="p-2 rounded-full bg-rose-500 text-white hover:scale-105 active:scale-95 transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* Quick Reaction Bubbles (❤️, 🔥, 👏, 💯) */}
          <div className="flex items-center gap-1.5 shrink-0 pl-1">
            {["❤️", "🔥", "👏", "💯"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendReaction(emoji)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md grid place-items-center text-sm transition active:scale-125"
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
