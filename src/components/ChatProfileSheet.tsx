import { AnimatePresence, motion } from "framer-motion";
import {
  Phone,
  Video,
  User,
  MoreHorizontal,
  ArrowLeft,
  Pencil,
  Folder,
  Clock,
  BellOff,
  Search,
  Ban,
  Flag,
  Trash2,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./Avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null; bio?: string | null };

export function ChatProfileSheet({
  open,
  onClose,
  peer,
  onDeleted,
  onStartCall,
  onSearchInChat,
  hasWallpaper,
  onSetWallpaper,
}: {
  open: boolean;
  onClose: () => void;
  peer: Profile | null;
  onDeleted?: () => void;
  onStartCall?: (type: "audio" | "video") => void;
  onSearchInChat?: () => void;
  hasWallpaper?: boolean;
  onSetWallpaper?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [disappearSec, setDisappearSec] = useState<number | null>(null);
  const [mediaTabOpen, setMediaTabOpen] = useState(false);
  const [sharedMedia, setSharedMedia] = useState<{ id: string; media_url: string | null; media_type: string | null; created_at: string; content?: string }[]>([]);

  useEffect(() => {
    if (!open || !peer) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: m }, { data: b }, { data: cs }, { data: msgs }] = await Promise.all([
        supabase.from("muted_chats").select("peer_id").eq("owner_id", u.user.id).eq("peer_id", peer.id).maybeSingle(),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", u.user.id).eq("blocked_id", peer.id).maybeSingle(),
        supabase.from("chat_settings").select("disappearing_seconds").eq("owner_id", u.user.id).eq("peer_id", peer.id).maybeSingle(),
        supabase
          .from("messages")
          .select("id, media_url, media_type, created_at, content")
          .or(`and(sender_id.eq.${u.user.id},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${u.user.id})`)
          .not("media_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      setMuted(!!m);
      setBlocked(!!b);
      setDisappearSec((cs as { disappearing_seconds: number | null } | null)?.disappearing_seconds ?? null);
      setSharedMedia((msgs ?? []) as typeof sharedMedia);
    })();
  }, [open, peer]);

  const toggleMute = async () => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (muted) {
      await supabase.from("muted_chats").delete().eq("owner_id", u.user.id).eq("peer_id", peer.id);
      setMuted(false);
      toast.success("Conversation unmuted");
    } else {
      await supabase.from("muted_chats").insert({ owner_id: u.user.id, peer_id: peer.id });
      setMuted(true);
      toast.success("Conversation muted");
    }
  };

  const toggleBlock = async () => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (blocked) {
      await supabase.from("blocks").delete().eq("blocker_id", u.user.id).eq("blocked_id", peer.id);
      setBlocked(false);
      toast.success("User unblocked");
    } else {
      await supabase.from("blocks").insert({ blocker_id: u.user.id, blocked_id: peer.id });
      setBlocked(true);
      toast.success("User blocked");
    }
  };

  const setDisappear = async (sec: number | null) => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setDisappearSec(sec);
    await supabase.from("chat_settings").upsert({
      owner_id: u.user.id,
      peer_id: peer.id,
      disappearing_seconds: sec,
      updated_at: new Date().toISOString(),
    });
    toast.success(sec ? `Disappearing timer set to ${sec >= 86400 ? `${sec / 86400}d` : sec >= 3600 ? `${sec / 3600}h` : `${sec / 60}m`}` : "Disappearing messages turned off");
  };

  const report = async (kind: "conversation" | "user") => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("reports").insert({
      reporter_id: u.user.id,
      target_kind: kind,
      target_user_id: peer.id,
      reason: "User reported from chat info menu",
    });
    toast.success(`Report submitted. Thank you for keeping Flick safe.`);
  };

  const deleteConvo = async () => {
    if (!peer) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from("messages")
      .delete()
      .or(`and(sender_id.eq.${u.user.id},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${u.user.id})`);
    toast.success("Conversation history cleared");
    onDeleted?.();
    onClose();
  };

  if (!open || !peer) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex justify-end"
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md h-[100dvh] bg-card border-l border-border flex flex-col overflow-y-auto"
        >
          <header className="flex items-center justify-between px-4 py-4 border-b border-border/60">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-secondary transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm">Contact Info</span>
            <Link to={`/u/${peer.handle}`} className="p-2 rounded-full hover:bg-secondary transition">
              <Pencil className="w-5 h-5" />
            </Link>
          </header>

          <div className="flex flex-col items-center px-6 py-6 border-b border-border/40">
            <Avatar url={peer.avatar_url} name={peer.display_name} size={110} ring />
            <h2 className="mt-4 text-xl font-bold flex items-center gap-1.5">
              {peer.display_name}
              <span className="inline-grid place-items-center w-4 h-4 rounded-full bg-snap text-snap-foreground text-[10px] font-black">
                ✓
              </span>
            </h2>
            <p className="text-muted-foreground text-sm">@{peer.handle}</p>
            {peer.bio && <p className="text-xs text-foreground/80 mt-2 text-center max-w-xs">{peer.bio}</p>}
          </div>

          {/* Quick Actions (Audio, Video, Profile, More) */}
          <div className="grid grid-cols-4 gap-2 px-6 py-4 relative border-b border-border/40">
            <ActionBtn
              icon={Phone}
              label="Call"
              onClick={() => {
                onClose();
                onStartCall?.("audio");
              }}
            />
            <ActionBtn
              icon={Video}
              label="Video"
              onClick={() => {
                onClose();
                onStartCall?.("video");
              }}
            />
            <Link to={`/u/${peer.handle}`} className="flex flex-col items-center gap-1.5 group">
              <div className="w-13 h-13 rounded-full bg-secondary group-hover:bg-secondary/70 grid place-items-center transition">
                <User className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground">Profile</span>
            </Link>
            <button onClick={() => setMenu((v) => !v)} className="flex flex-col items-center gap-1.5 group">
              <div className="w-13 h-13 rounded-full bg-secondary group-hover:bg-secondary/70 grid place-items-center transition">
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground">More</span>
            </button>

            {/* 3-dot dropdown menu */}
            <AnimatePresence>
              {menu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute right-4 top-[74px] w-60 card-glass rounded-2xl py-2 shadow-2xl border border-border z-20"
                >
                  {[
                    { icon: BellOff, label: muted ? "Unmute conversation" : "Mute conversation", action: toggleMute },
                    {
                      icon: Search,
                      label: "Search in conversation",
                      action: () => {
                        setMenu(false);
                        onClose();
                        onSearchInChat?.();
                      },
                    },
                    { icon: Ban, label: blocked ? "Unblock messages" : "Block messages", action: toggleBlock },
                  ].map((m) => (
                    <button
                      key={m.label}
                      onClick={() => {
                        m.action();
                        setMenu(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 text-sm text-left transition"
                    >
                      <span>{m.label}</span>
                      <m.icon className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                  <div className="h-px bg-border my-1" />
                  {[
                    { icon: Flag, label: "Report conversation", danger: true, action: () => report("conversation") },
                    { icon: Flag, label: "Report user", danger: true, action: () => report("user") },
                    { icon: Trash2, label: "Delete conversation", danger: true, action: deleteConvo },
                  ].map((m) => (
                    <button
                      key={m.label}
                      onClick={() => {
                        m.action();
                        setMenu(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 text-rose-400 text-sm text-left transition"
                    >
                      <span>{m.label}</span>
                      <m.icon className="w-4 h-4" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings & Options list */}
          <div className="p-4 space-y-3">
            <div className="card-glass rounded-2xl divide-y divide-border/60">
              <Row
                icon={Folder}
                label="Media, Links & Docs"
                right={`${sharedMedia.length} item${sharedMedia.length === 1 ? "" : "s"} ›`}
                onClick={() => setMediaTabOpen(true)}
              />
              <Row
                icon={ImageIcon}
                label="Chat Wallpaper"
                right={hasWallpaper ? "Custom ›" : "Default ›"}
                onClick={() => {
                  onClose();
                  onSetWallpaper?.();
                }}
              />
              <DisappearingRow value={disappearSec} onChange={setDisappear} />
              <Row
                icon={BellOff}
                label={muted ? "Muted" : "Notifications on"}
                right={muted ? "On" : "Off"}
                onClick={toggleMute}
              />
              <Row
                icon={Ban}
                label={blocked ? "Blocked" : "Block user"}
                right={blocked ? "On" : "Off"}
                onClick={toggleBlock}
              />
            </div>
          </div>

          {/* Shared Media Slide-over Sheet */}
          <AnimatePresence>
            {mediaTabOpen && (
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                className="absolute inset-0 bg-card z-30 flex flex-col overflow-y-auto"
              >
                <header className="p-4 flex items-center justify-between border-b border-border shrink-0">
                  <button onClick={() => setMediaTabOpen(false)} className="p-2 -ml-2 rounded-full hover:bg-secondary">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h3 className="font-bold text-sm">Media, Links & Docs</h3>
                  <div className="w-5" />
                </header>

                <div className="p-4 flex-1">
                  {sharedMedia.length === 0 ? (
                    <div className="text-center py-24 text-muted-foreground">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30 text-snap" />
                      <p className="text-sm font-semibold text-foreground">No media shared yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Photos, voice notes and files sent in this chat appear here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {sharedMedia.map((m) => (
                        <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-secondary relative group">
                          {m.media_url ? (
                            <img src={m.media_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
                              <FileText className="w-6 h-6 text-snap" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function DisappearingRow({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const label =
    value == null ? "Off" : value >= 86400 ? `${value / 86400}d` : value >= 3600 ? `${value / 3600}h` : `${value / 60}m`;
  const opts: { l: string; v: number | null }[] = [
    { l: "Off", v: null },
    { l: "5 minutes", v: 300 },
    { l: "1 hour", v: 3600 },
    { l: "24 hours", v: 86400 },
    { l: "7 days", v: 604800 },
  ];
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/30 transition">
        <Clock className="w-5 h-5 text-snap" />
        <span className="flex-1 text-sm font-medium">Disappearing messages</span>
        <span className="text-xs text-muted-foreground font-mono">{label}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {opts.map((o) => (
            <button
              key={o.l}
              onClick={() => {
                onChange(o.v);
                setOpen(false);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                (value ?? null) === o.v ? "bg-snap text-snap-foreground font-bold" : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: typeof Phone; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <div className="w-13 h-13 rounded-full bg-secondary group-hover:bg-snap group-hover:text-snap-foreground grid place-items-center transition">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}

function Row({
  icon: Icon,
  label,
  right,
  onClick,
  dim,
}: {
  icon: typeof Phone;
  label: string;
  right?: string;
  onClick?: () => void;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/30 transition ${
        dim ? "opacity-50" : ""
      }`}
    >
      <Icon className="w-5 h-5 text-snap" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {right && <span className="text-xs text-muted-foreground font-mono">{right}</span>}
    </button>
  );
}