import { useState, useRef, useEffect } from "react";
import {
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Share2,
  Users,
  Heart,
  Flame,
  MessageCircle,
  X,
  Sparkles,
  Send,
  ScreenShare,
  Shield,
  Eye,
  LogOut,
  Settings,
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
  onJoinAsViewer: (session: LiveBroadcastSession) => void;
  onRequestGoLiveModal: () => void;
}

export function LiveBroadcastView({ onJoinAsViewer, onRequestGoLiveModal }: Props) {
  const { user, profile } = useAuth();
  const [activeSessions, setActiveSessions] = useState<LiveBroadcastSession[]>(() =>
    SpaceService.getLiveSessions().filter((s) => s.status === "live" || s.status === "starting")
  );

  // Active broadcaster state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [currentSession, setCurrentSession] = useState<LiveBroadcastSession | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [viewerCount, setViewerCount] = useState(1);
  const [likesCount, setLikesCount] = useState(0);

  // Real-time chat & reactions
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [floatingReactions, setFloatingReactions] = useState<LiveReaction[]>([]);

  // Video element ref & WebRTC engine ref
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const rtcEngineRef = useRef<WebRtcEngine | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Sync active sessions on custom events
  useEffect(() => {
    const handleSync = () => {
      setActiveSessions(
        SpaceService.getLiveSessions().filter((s) => s.status === "live" || s.status === "starting")
      );
    };
    window.addEventListener("flick:space-live-updated", handleSync);

    const handleExternalStart = (e: Event) => {
      const custom = e as CustomEvent<{ title: string; category: any; visibility: any }>;
      if (custom.detail) {
        handleStartBroadcast(custom.detail.title, custom.detail.category, custom.detail.visibility);
      }
    };
    window.addEventListener("flick:start-broadcast", handleExternalStart);

    return () => {
      window.removeEventListener("flick:space-live-updated", handleSync);
      window.removeEventListener("flick:start-broadcast", handleExternalStart);
    };
  }, [user, profile, camActive, micActive, facingMode]);

  // Broadcaster cleanup on unmount
  useEffect(() => {
    return () => {
      if (rtcEngineRef.current) {
        rtcEngineRef.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const handleStartBroadcast = async (
    title: string,
    category: LiveBroadcastSession["category"],
    visibility: LiveBroadcastSession["visibility"]
  ) => {
    if (!user) {
      toast.error("Please sign in to broadcast");
      return;
    }

    try {
      void triggerMediumHaptic();
      const session = SpaceService.createLiveSession({
        hostId: user.id,
        hostName: profile?.display_name || "Creator",
        hostHandle: profile?.handle || "creator",
        hostAvatar: profile?.avatar_url,
        title: title.trim() || "Live on Flick Space",
        category,
        visibility,
        allowComments: true,
        allowGuestInvites: true,
      });

      setCurrentSession(session);
      setIsBroadcasting(true);
      setLikesCount(0);
      setViewerCount(1);

      // 1. Initialize real WebRTC media stream
      const engine = new WebRtcEngine(user.id);
      rtcEngineRef.current = engine;
      const stream = await engine.startLocalMedia(camActive, micActive, facingMode);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      // 2. Set up real-time live channel
      const chName = `space:live:${session.id}`;
      const rtcChannelName = `space:live:${session.id}:rtc`;
      engine.initSignaling(rtcChannelName, true);

      // Clean up any existing channel with the same topic to avoid re-subscribing conflicts
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${chName}`);
      if (existing) {
        supabase.removeChannel(existing);
      }

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
        .on("presence", { event: "sync" }, () => {
          const state = ch.presenceState();
          const count = Math.max(1, Object.keys(state).length);
          setViewerCount(count);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.track({
              userId: user.id,
              name: profile?.display_name || "Host",
              isHost: true,
              onlineAt: Date.now(),
            });
            SpaceService.updateLiveStatus(session.id, "live");
            toast.success("You are now LIVE on Flick Space! 🔴");
          }
        });

      channelRef.current = ch;
    } catch (err) {
      toast.error(`Broadcast startup failed: ${(err as Error).message}`);
      setIsBroadcasting(false);
      setCurrentSession(null);
    }
  };

  const handleResumeBroadcast = async (session: LiveBroadcastSession) => {
    if (!user) return;
    try {
      void triggerMediumHaptic();
      setCurrentSession(session);
      setIsBroadcasting(true);
      setViewerCount(session.viewerCount || 1);
      setLikesCount(session.likesCount || 0);

      if (rtcEngineRef.current) rtcEngineRef.current.close();
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const engine = new WebRtcEngine(user.id);
      rtcEngineRef.current = engine;
      const stream = await engine.startLocalMedia(camActive, micActive, facingMode);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const chName = `space:live:${session.id}`;
      const rtcChannelName = `space:live:${session.id}:rtc`;
      engine.initSignaling(rtcChannelName, true);

      const ch = supabase
        .channel(chName)
        .on("broadcast", { event: "chat-message" }, ({ payload }) => {
          setChatMessages((prev) => [...prev.slice(-40), payload as LiveChatMessage]);
        })
        .on("broadcast", { event: "reaction" }, ({ payload }) => {
          const reaction = payload as LiveReaction;
          setFloatingReactions((prev) => [...prev.slice(-15), reaction]);
          setLikesCount((prev) => prev + 1);
        })
        .on("broadcast", { event: "viewer-count" }, ({ payload }) => {
          if (payload?.count) setViewerCount(payload.count);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            SpaceService.updateLiveStatus(session.id, "live");
            toast.success("Resumed your LIVE Broadcast Studio! 🔴");
          }
        });

      channelRef.current = ch;
    } catch (err) {
      toast.error(`Could not resume broadcast: ${(err as Error).message}`);
    }
  };

  const handleEndBroadcast = () => {
    if (!currentSession) return;
    void triggerMediumHaptic();
    SpaceService.updateLiveStatus(currentSession.id, "ended");

    if (rtcEngineRef.current) {
      rtcEngineRef.current.close();
      rtcEngineRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsBroadcasting(false);
    setCurrentSession(null);
    toast("Broadcast ended.");
  };

  const handleFlipCamera = async () => {
    void triggerLightHaptic();
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (rtcEngineRef.current) {
      const stream = await rtcEngineRef.current.startLocalMedia(camActive, micActive, nextMode);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      toast(`Switched to ${nextMode === "user" ? "front" : "rear"} camera`);
    }
  };

  const handleToggleMic = () => {
    void triggerLightHaptic();
    const next = !micActive;
    setMicActive(next);
    if (rtcEngineRef.current) {
      rtcEngineRef.current.toggleMic(next);
    }
  };

  const handleToggleCam = () => {
    void triggerLightHaptic();
    const next = !camActive;
    setCamActive(next);
    if (rtcEngineRef.current) {
      rtcEngineRef.current.toggleCam(next);
    }
  };

  const handleSendHostComment = () => {
    if (!chatInput.trim() || !channelRef.current || !user) return;
    const msg: LiveChatMessage = {
      id: `msg_${Date.now()}`,
      sessionId: currentSession?.id || "",
      userId: user.id,
      userName: profile?.display_name || "Host",
      userHandle: profile?.handle || "host",
      userAvatar: profile?.avatar_url,
      message: chatInput.trim(),
      timestamp: Date.now(),
      isHost: true,
    };
    void channelRef.current.send({
      type: "broadcast",
      event: "chat",
      payload: msg,
    });
    setChatInput("");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* If Broadcaster is actively live */}
      {isBroadcasting && currentSession ? (
        <div className="relative flex-1 w-full h-full bg-black overflow-hidden flex flex-col select-none">
          {/* Main Video Stage */}
          <video
            ref={videoPreviewRef}
            playsInline
            autoPlay
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Dark Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none" />

          {/* Top Broadcaster HUD */}
          <div className="relative z-20 flex items-center justify-between p-4">
            <div className="flex items-center gap-2.5">
              <div className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/40">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>LIVE</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white font-mono text-xs flex items-center gap-1.5 border border-white/10">
                <Users className="w-3.5 h-3.5 text-zinc-300" />
                <span>{viewerCount}</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white font-mono text-xs flex items-center gap-1.5 border border-white/10">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>{likesCount}</span>
              </div>
            </div>

            {/* End Broadcast Button */}
            <button
              type="button"
              onClick={handleEndBroadcast}
              className="px-3.5 py-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>End Live</span>
            </button>
          </div>

          {/* Floating Reaction Hearts Stream */}
          <div className="absolute bottom-28 right-4 z-20 pointer-events-none flex flex-col items-center gap-2">
            <AnimatePresence>
              {floatingReactions.slice(-6).map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 1, y: 0, scale: 0.8 }}
                  animate={{ opacity: 0, y: -90, scale: 1.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-2xl"
                >
                  {r.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Lower HUD: Real-time Comments overlay */}
          <div className="relative z-20 mt-auto p-4 flex flex-col gap-3">
            {/* Live Chat Stream */}
            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1.5 mask-gradient-b">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="inline-flex items-start gap-1.5 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md text-xs text-white max-w-[85%] border border-white/10"
                >
                  <span className="font-bold text-rose-400">@{msg.userHandle}:</span>
                  <span className="text-zinc-100">{msg.message}</span>
                </div>
              ))}
            </div>

            {/* Broadcaster Control Dock */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              {/* Chat Input Bar */}
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendHostComment();
                  }}
                  placeholder="Say something to your live audience…"
                  className="w-full bg-black/50 border border-white/20 rounded-full px-4 py-2 text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={handleSendHostComment}
                  className="p-2 rounded-full bg-rose-500 text-white hover:scale-105 active:scale-95 transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hardware Toggles: Flip Cam, Mute, Video */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  className="w-9 h-9 rounded-full bg-black/60 border border-white/20 text-white grid place-items-center hover:bg-black/80 transition active:scale-95"
                  title="Switch Camera (Front/Rear)"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`w-9 h-9 rounded-full border grid place-items-center transition active:scale-95 ${
                    micActive
                      ? "bg-black/60 border-white/20 text-white"
                      : "bg-rose-600 border-rose-500 text-white"
                  }`}
                  title={micActive ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleCam}
                  className={`w-9 h-9 rounded-full border grid place-items-center transition active:scale-95 ${
                    camActive
                      ? "bg-black/60 border-white/20 text-white"
                      : "bg-rose-600 border-rose-500 text-white"
                  }`}
                  title={camActive ? "Turn Video Off" : "Turn Video On"}
                >
                  {camActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Regular Live Directory & Start Broadcast Launchpad */
        <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Hero Banner: Start Live Broadcast */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-rose-950/80 via-zinc-900 to-amber-950/60 border border-rose-500/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 text-center sm:text-left max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xs border border-rose-500/30">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>GENUINE LIVE BROADCASTING</span>
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
                Share your world in real-time
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Stream low-latency audio & video directly to followers. Receive live reactions, interactive comments, and invite guests to speak.
              </p>
            </div>

            <button
              type="button"
              onClick={onRequestGoLiveModal}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-bold text-sm shadow-xl shadow-rose-600/30 hover:opacity-95 active:scale-95 transition flex items-center gap-2 shrink-0"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Start Live Broadcast</span>
            </button>
          </div>

          {/* Active Live Broadcasts Grid */}
          <div className="space-y-4">
            {/* If host has an active broadcast, show prominent resume banner */}
            {activeSessions.find((s) => s.hostId === user?.id) && (
              <div className="rounded-2xl p-4 bg-gradient-to-r from-rose-950/80 via-zinc-900 to-amber-950/40 border border-rose-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping absolute inset-0 m-auto" />
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 block relative" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>You have an active live broadcast:</span>
                      <span className="text-rose-400">"{activeSessions.find((s) => s.hostId === user?.id)?.title}"</span>
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {activeSessions.find((s) => s.hostId === user?.id)?.viewerCount || 1} people in stream · You are the Host
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const mine = activeSessions.find((s) => s.hostId === user?.id);
                      if (mine) handleResumeBroadcast(mine);
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30"
                  >
                    <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
                    <span>Resume Studio 🔴</span>
                  </button>
                  <button
                    onClick={() => {
                      const mine = activeSessions.find((s) => s.hostId === user?.id);
                      if (mine) {
                        SpaceService.updateLiveStatus(mine.id, "ended");
                        toast("Broadcast ended.");
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-semibold transition"
                  >
                    End Stream
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <h3 className="font-display font-bold text-lg text-foreground">
                  Active Live Streams
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {activeSessions.length} active
              </span>
            </div>

            {activeSessions.length === 0 ? (
              <div className="py-16 text-center space-y-3 rounded-3xl bg-card border border-border p-8 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 grid place-items-center mx-auto">
                  <Radio className="w-7 h-7" />
                </div>
                <h4 className="font-display font-bold text-base text-foreground">
                  No active broadcasts right now
                </h4>
                <p className="text-xs text-muted-foreground">
                  Be the first to go live! Start a broadcast with your camera, talk with followers, and share real-time moments.
                </p>
                <button
                  type="button"
                  onClick={onRequestGoLiveModal}
                  className="px-4 py-2 rounded-2xl bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition"
                >
                  Go Live Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map((session) => {
                  const isMyBroadcast = user?.id === session.hostId;
                  return (
                    <div
                      key={session.id}
                      className={`group rounded-3xl overflow-hidden transition flex flex-col justify-between ${
                        isMyBroadcast
                          ? "bg-rose-950/20 border-2 border-rose-500/60 shadow-lg shadow-rose-500/10"
                          : "bg-card border border-border shadow-sm hover:shadow-md"
                      }`}
                    >
                      {/* Live Preview Header */}
                      <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 grid place-items-center animate-pulse">
                          <Radio className="w-8 h-8" />
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                            LIVE
                          </span>
                          {isMyBroadcast && (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                              <Sparkles className="w-2.5 h-2.5" />
                              YOUR BROADCAST
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-mono">
                            {session.category}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1">
                          <Users className="w-3 h-3 text-zinc-300" />
                          <span>{session.viewerCount}</span>
                        </div>

                        <div className="absolute bottom-3 inset-x-3 text-white">
                          <h4 className="font-display font-bold text-sm truncate drop-shadow-sm">
                            {session.title}
                          </h4>
                        </div>
                      </div>

                      {/* Host Details & Action */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            url={session.hostAvatar}
                            name={session.hostName}
                            size={36}
                            ring
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-foreground truncate flex items-center gap-1">
                              <span>{session.hostName}</span>
                              {isMyBroadcast && (
                                <span className="text-[10px] text-rose-400 font-semibold">(You)</span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              @{session.hostHandle}
                            </div>
                          </div>
                        </div>

                        {isMyBroadcast ? (
                          <button
                            type="button"
                            onClick={() => handleResumeBroadcast(session)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 active:scale-95 transition flex items-center justify-center gap-1.5"
                          >
                            <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
                            <span>Resume Studio (You Are Live) 🔴</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onJoinAsViewer(session)}
                            className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 hover:bg-zinc-800"
                          >
                            <Eye className="w-3.5 h-3.5 text-rose-500" />
                            <span>Watch Broadcast</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
