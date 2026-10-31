import { useState, useEffect, useRef } from "react";
import {
  Users,
  Mic,
  MicOff,
  Hand,
  Plus,
  Share2,
  X,
  Volume2,
  Sparkles,
  Shield,
  LogOut,
  Hash,
  Crown,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { SpaceService } from "@/lib/space/spaceService";
import type { AudioRoom, RoomParticipant, RoomRole } from "@/lib/space/types";

export function AudioRoomsView() {
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<AudioRoom[]>(() => SpaceService.getAudioRooms());
  const [activeRoom, setActiveRoom] = useState<AudioRoom | null>(null);

  // Active room local state
  const [isMuted, setIsMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New room form
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("Tech & Campus");
  const [newRoomType, setNewRoomType] = useState<AudioRoom["roomType"]>("public");

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const sync = () => setRooms(SpaceService.getAudioRooms());
    window.addEventListener("flick:space-rooms-updated", sync);
    return () => window.removeEventListener("flick:space-rooms-updated", sync);
  }, []);

  // Handle active room channel subscriptions
  useEffect(() => {
    if (!activeRoom || !user) return;

    const chName = `space:room:${activeRoom.id}`;
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${chName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const ch = supabase.channel(chName, {
      config: { broadcast: { self: true }, presence: { key: user.id } },
    });

    ch.on("broadcast", { event: "role_updated" }, ({ payload }) => {
      setActiveRoom((prev) => {
        if (!prev) return null;
        const updated = prev.participants.map((p) =>
          p.userId === payload.userId ? { ...p, role: payload.role, isMuted: payload.isMuted } : p
        );
        return { ...prev, participants: updated };
      });
      if (payload.userId === user.id) {
        toast(`You are now a ${payload.role}!`);
      }
    })
      .on("broadcast", { event: "hand_toggled" }, ({ payload }) => {
        setActiveRoom((prev) => {
          if (!prev) return null;
          const updated = prev.participants.map((p) =>
            p.userId === payload.userId ? { ...p, handRaised: payload.handRaised } : p
          );
          return { ...prev, participants: updated };
        });
      })
      .on("presence", { event: "sync" }, () => {
        // Presence sync
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({
            userId: user.id,
            name: profile?.display_name || "User",
            role: activeRoom.hostId === user.id ? "host" : "listener",
          });
        }
      });

    channelRef.current = ch;

    const streamToClean = audioStreamRef.current;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (streamToClean) {
        streamToClean.getTracks().forEach((t) => t.stop());
      }
    };
  }, [activeRoom?.id, user?.id]);

  const handleCreateRoom = async () => {
    if (!user) {
      toast.error("Please sign in to host a room");
      return;
    }
    if (!newTitle.trim()) {
      toast.error("Please enter a room title");
      return;
    }

    void triggerMediumHaptic();
    const hostParticipant: RoomParticipant = {
      userId: user.id,
      userName: profile?.display_name || "Host",
      userHandle: profile?.handle || "host",
      userAvatar: profile?.avatar_url,
      role: "host",
      isMuted: false,
      isSpeaking: false,
      handRaised: false,
      joinedAt: Date.now(),
    };

    const room = SpaceService.createAudioRoom(
      {
        hostId: user.id,
        hostName: profile?.display_name || "Host",
        hostHandle: profile?.handle || "host",
        hostAvatar: profile?.avatar_url,
        title: newTitle.trim(),
        topicTag: newTopic,
        roomType: newRoomType,
        maxCapacity: 100,
      },
      hostParticipant
    );

    setActiveRoom(room);
    setShowCreateModal(false);
    setNewTitle("");
    toast.success("Audio Room created! You are on stage as host. 🎙️");
  };

  const handleJoinRoom = (room: AudioRoom) => {
    if (!user) {
      toast.error("Please sign in to join audio rooms");
      return;
    }
    void triggerMediumHaptic();

    const isHost = room.hostId === user.id;

    const participant: RoomParticipant = {
      userId: user.id,
      userName: profile?.display_name || (isHost ? room.hostName : "Listener"),
      userHandle: profile?.handle || (isHost ? room.hostHandle : "listener"),
      userAvatar: profile?.avatar_url || (isHost ? room.hostAvatar : undefined),
      role: isHost ? "host" : "listener",
      isMuted: isHost ? false : true,
      isSpeaking: false,
      handRaised: false,
      joinedAt: Date.now(),
    };

    SpaceService.joinAudioRoom(room.id, participant);
    setActiveRoom({
      ...room,
      participants: [...room.participants.filter((p) => p.userId !== user.id), participant],
    });

    if (isHost) {
      toast.success("Welcome back to your stage as Host! 🎙️");
    } else {
      toast(`Joined "${room.title}" quietly as a listener`);
    }
  };

  const handleLeaveRoom = () => {
    if (!activeRoom || !user) return;
    void triggerLightHaptic();
    SpaceService.leaveAudioRoom(activeRoom.id, user.id);
    setActiveRoom(null);
    toast("Left audio room.");
  };

  const handleToggleHand = () => {
    if (!activeRoom || !user || !channelRef.current) return;
    void triggerLightHaptic();
    const next = !handRaised;
    setHandRaised(next);
    void channelRef.current.send({
      type: "broadcast",
      event: "hand_toggled",
      payload: { userId: user.id, handRaised: next },
    });
    toast(next ? "Hand raised! Host notified." : "Hand lowered");
  };

  const handlePromoteToSpeaker = (targetUserId: string) => {
    if (!activeRoom || !channelRef.current) return;
    void triggerMediumHaptic();
    SpaceService.updateParticipantRole(activeRoom.id, targetUserId, {
      role: "speaker",
      handRaised: false,
      isMuted: false,
    });
    void channelRef.current.send({
      type: "broadcast",
      event: "role_updated",
      payload: { userId: targetUserId, role: "speaker", isMuted: false },
    });
  };

  const myParticipant = activeRoom?.participants.find((p) => p.userId === user?.id);
  const isHostOrSpeaker = myParticipant?.role === "host" || myParticipant?.role === "speaker";

  const speakers = activeRoom?.participants.filter(
    (p) => p.role === "host" || p.role === "co-host" || p.role === "speaker"
  ) || [];
  const listeners = activeRoom?.participants.filter((p) => p.role === "listener") || [];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {activeRoom ? (
        /* ==================== ACTIVE AUDIO ROOM STAGE ==================== */
        <div className="flex-1 w-full h-full bg-background flex flex-col overflow-hidden">
          {/* Room Header */}
          <div className="px-5 py-4 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {activeRoom.topicTag}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>{activeRoom.participants.length}</span>
                </span>
              </div>
              <h2 className="font-display font-bold text-base sm:text-lg text-foreground mt-0.5">
                {activeRoom.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleLeaveRoom}
              className="px-3.5 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-rose-500 font-bold text-xs transition active:scale-95 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Quietly</span>
            </button>
          </div>

          {/* Room Stage Area: Speakers & Listeners */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6 max-w-4xl mx-auto w-full">
            {/* Speakers / Stage */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Stage ({speakers.length})
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {speakers.map((p) => {
                  const isCurrentHost = p.role === "host";
                  return (
                    <div key={p.userId} className="flex flex-col items-center text-center group">
                      <div className="relative">
                        <Avatar url={p.userAvatar} name={p.userName} size={64} ring={!p.isMuted} />
                        {isCurrentHost && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black grid place-items-center shadow-md">
                            <Crown className="w-3 h-3 stroke-[2.5]" />
                          </div>
                        )}
                        <div
                          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border border-background shadow-sm ${
                            p.isMuted ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
                          }`}
                        >
                          {p.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        </div>
                      </div>
                      <span className="font-bold text-xs text-foreground mt-2 truncate w-full">
                        {p.userName}
                      </span>
                      <span className="text-[10px] text-muted-foreground capitalize">{p.role}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audience / Listeners */}
            <div className="space-y-3 pt-4 border-t border-border">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Audience ({listeners.length})
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {listeners.map((p) => {
                  const isMe = p.userId === user?.id;
                  const amHost = activeRoom.hostId === user?.id;
                  return (
                    <div key={p.userId} className="flex flex-col items-center text-center">
                      <div className="relative">
                        <Avatar url={p.userAvatar} name={p.userName} size={48} />
                        {p.handRaised && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black grid place-items-center shadow-md animate-bounce">
                            <Hand className="w-3 h-3 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                      <span className="font-semibold text-[11px] text-foreground mt-1 truncate w-full">
                        {p.userName}
                      </span>
                      {amHost && p.handRaised && (
                        <button
                          type="button"
                          onClick={() => handlePromoteToSpeaker(p.userId)}
                          className="mt-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold shadow-sm"
                        >
                          Invite Speak
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Audio Room Action Bar */}
          <div className="p-4 border-t border-border bg-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {isHostOrSpeaker ? (
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition shadow-sm active:scale-95 ${
                    isMuted
                      ? "bg-rose-500/10 text-rose-500 border border-rose-500"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleHand}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition shadow-sm active:scale-95 ${
                    handRaised
                      ? "bg-amber-500 text-black ring-2 ring-amber-500/30"
                      : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  <span>{handRaised ? "Hand Raised ✋" : "Raise Hand to Speak"}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                navigator.clipboard?.writeText(window.location.href);
                toast.success("Room link copied to clipboard!");
              }}
              className="p-2.5 rounded-full bg-secondary text-foreground hover:bg-secondary/80 transition active:scale-95"
              title="Share Room Link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* ==================== ROOM DIRECTORY & CREATION ==================== */
        <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Create Room Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-amber-950/70 via-zinc-900 to-rose-950/60 border border-amber-500/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 text-center sm:text-left max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/30">
                <Users className="w-3.5 h-3.5" />
                <span>LARGE AUDIO SPACES</span>
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
                Host group audio rooms & discussions
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Connect speakers and listeners in high-fidelity audio rooms. Moderate speaking turns, invite co-hosts, and discuss trending campus topics.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-sm shadow-xl shadow-amber-500/25 hover:opacity-95 active:scale-95 transition flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Host an Audio Room</span>
            </button>
          </div>

          {/* Rooms Grid */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Mic className="w-4 h-4 text-amber-500" />
              <span>Live & Scheduled Audio Rooms</span>
            </h3>

            {rooms.length === 0 ? (
              <div className="py-16 text-center space-y-3 rounded-3xl bg-card border border-border p-8 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 grid place-items-center mx-auto">
                  <Users className="w-7 h-7" />
                </div>
                <h4 className="font-display font-bold text-base text-foreground">No active audio rooms</h4>
                <p className="text-xs text-muted-foreground">
                  Start a discussion room around campus life, exams, tech, or music.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-2xl bg-amber-500 text-black font-bold text-xs shadow-md active:scale-95 transition"
                >
                  Create First Room
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => {
                  const isMyRoom = user?.id === room.hostId;
                  return (
                    <div
                      key={room.id}
                      className={`p-5 rounded-3xl space-y-3.5 shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                        isMyRoom
                          ? "bg-amber-950/20 border-2 border-amber-500/60 shadow-amber-500/10"
                          : "bg-card border border-border"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              {room.topicTag}
                            </span>
                            {isMyRoom && (
                              <span className="font-bold font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-500 text-black flex items-center gap-1 shadow-sm">
                                <Sparkles className="w-2.5 h-2.5" />
                                HOSTING (YOU)
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground font-mono flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{room.participants.length} listeners</span>
                          </span>
                        </div>
                        <h4 className="font-display font-bold text-base text-foreground leading-snug">
                          {room.title}
                        </h4>
                      </div>

                      {/* Host & Speaker Thumbnails */}
                      <div className="flex items-center gap-2">
                        <Avatar url={room.hostAvatar} name={room.hostName} size={32} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                            <span>Hosted by {room.hostName}</span>
                            {isMyRoom && (
                              <span className="text-[10px] text-amber-400 font-semibold">(You)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            @{room.hostHandle}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleJoinRoom(room)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 border ${
                          isMyRoom
                            ? "bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow-md shadow-amber-500/25"
                            : "bg-secondary hover:bg-secondary/80 text-foreground border-border"
                        }`}
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isMyRoom ? "text-black" : "text-amber-500"}`} />
                        <span>{isMyRoom ? "Enter Host Stage 🎙️" : "Join Room"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <h3 className="font-display font-bold text-base text-foreground">Create Audio Room</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-7 h-7 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Room Topic Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Campus Founders Talk, Tech Career Q&A…"
                  className="w-full bg-secondary/80 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Category Tag</label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full bg-secondary/80 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateRoom}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition"
              >
                Launch Room on Stage
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
