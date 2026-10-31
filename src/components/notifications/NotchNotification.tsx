import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Camera,
  AtSign,
  FileText,
  Bell,
  X,
  ChevronRight,
  Radio,
  Send,
  CornerDownRight,
  CheckCheck,
  Undo2,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { notificationAudio } from "@/lib/notificationAudio";
import { soundEngine } from "@/lib/soundEngine";
import { isNotificationCategoryEnabled } from "@/lib/appPrefs";
import { supabase } from "@/integrations/supabase/client";

import {
  type NotchStyle,
  type NotchNotificationItem,
  getStoredNotchStyle,
  playNotificationChime,
} from "@/lib/notchNotification";

export function NotchNotification() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<NotchNotificationItem | null>(null);
  const [style, setStyle] = useState<NotchStyle>(getStoredNotchStyle);
  const [isReplying, setIsReplying] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [progress, setProgress] = useState(100);
  const dismissTimerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Sync style preference
  useEffect(() => {
    const onStyleChange = (e: Event) => {
      const s = (e as CustomEvent).detail as NotchStyle;
      if (s) setStyle(s);
    };
    window.addEventListener("flick:notch-style-changed", onStyleChange);
    return () => window.removeEventListener("flick:notch-style-changed", onStyleChange);
  }, []);

  // Listen for notification triggers
  useEffect(() => {
    const handleNotchEvent = (e: Event) => {
      const item = (e as CustomEvent).detail as NotchNotificationItem;
      if (!item) return;

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      setCurrent(item);
      setIsReplying(false);
      setQuickReplyText("");
      setReplySent(false);
      setProgress(100);

      if (notificationAudio.isVoiceEnabled()) {
        const headlineOrContent = item.kind === "news" ? (item.message || item.title) : (item.message || item.title);
        void notificationAudio.playNotificationAudio(item.kind, item.actor, undefined, headlineOrContent);
      }
      if (soundEngine.isSoundEnabled()) {
        playNotificationChime();
      }

      try {
        if ("vibrate" in navigator) navigator.vibrate([35, 50, 35]);
      } catch {}

      // Countdown timer for progress bar
      const totalDuration = 6500;
      const intervalMs = 100;
      const step = (intervalMs / totalDuration) * 100;

      progressIntervalRef.current = window.setInterval(() => {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(progressIntervalRef.current!);
            return 0;
          }
          return Math.max(0, prev - step);
        });
      }, intervalMs);

      // Auto dismiss after 6.5s
      dismissTimerRef.current = window.setTimeout(() => {
        setCurrent(null);
      }, totalDuration);
    };

    window.addEventListener("flick:notification-notch", handleNotchEvent);
    return () => {
      window.removeEventListener("flick:notification-notch", handleNotchEvent);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const dismiss = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setCurrent(null);
    setIsReplying(false);
  };

  const handleClick = () => {
    if (!current) return;
    const targetUrl = current.url;
    dismiss();
    if (targetUrl) {
      navigate(targetUrl);
    } else if (current.kind === "message" && current.actor?.id) {
      navigate(`/messages/${current.actor.id}`);
    } else if (current.actor?.handle) {
      navigate(`/u/${current.actor.handle}`);
    } else {
      navigate("/");
    }
  };

  const handleSendQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim() || !current?.actor?.id) return;

    const recipientId = current.actor.id;
    const text = quickReplyText.trim();

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (currentUserId) {
        await supabase.from("messages").insert({
          sender_id: currentUserId,
          recipient_id: recipientId,
          content: text,
        });
      }
      setReplySent(true);
      setQuickReplyText("");
      setTimeout(() => {
        dismiss();
      }, 1500);
    } catch {
      dismiss();
    }
  };

  const getKindIcon = (k: string) => {
    switch (k) {
      case "like":
        return <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />;
      case "message":
        return <MessageCircle className="w-4 h-4 text-purple-400 fill-purple-400/30" />;
      case "story":
        return <Camera className="w-4 h-4 text-cyan-400" />;
      case "mention":
        return <AtSign className="w-4 h-4 text-yellow-400" />;
      case "post":
        return <FileText className="w-4 h-4 text-snap" />;
      case "news":
        return <Radio className="w-4 h-4 text-amber-400 animate-pulse" />;
      default:
        return <Bell className="w-4 h-4 text-snap" />;
    }
  };

  const getCategoryLabel = (k: string) => {
    switch (k) {
      case "message":
        return "Direct Message";
      case "like":
        return "New Reaction";
      case "story":
        return "Story Mention";
      case "news":
        return "Breaking News Wire";
      case "post":
        return "Timeline Activity";
      default:
        return "Flick Push";
    }
  };

  return (
    <div className="fixed top-3 md:top-5 inset-x-0 z-[99999] pointer-events-none flex justify-center px-3 md:px-4">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -65, scale: 0.92, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: -45, scale: 0.94, filter: "blur(6px)" }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 28,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -30) dismiss();
            }}
            className="pointer-events-auto cursor-pointer w-full max-w-lg select-none"
            style={{ perspective: 1000 }}
          >
            {/* BIG PROMINENT IN-APP PUSH NOTIFICATION CARD */}
            <div
              onClick={() => {
                if (!isReplying) handleClick();
              }}
              className="bg-[#0b0d14]/95 text-white rounded-3xl p-4 md:p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border border-white/20 backdrop-blur-3xl relative overflow-hidden group transition-all hover:border-white/30"
            >
              {/* Top ambient lighting sweep */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-snap to-transparent opacity-80" />
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-snap/15 rounded-full blur-3xl pointer-events-none" />

              {/* Header row: Branding, Category & Dismiss */}
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-snap animate-ping" />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-snap">
                    FLICK PUSH
                  </span>
                  <span className="text-white/30">·</span>
                  <span className="text-[11px] font-semibold text-white/70">
                    {getCategoryLabel(current.kind)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/40 font-mono">Just now</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss();
                    }}
                    className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/15 transition"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main message body with large avatar */}
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <Avatar
                    url={current.actor?.avatar_url}
                    name={current.actor?.display_name || current.actor?.handle || "User"}
                    size={48}
                  />
                  <div className="absolute -bottom-1 -right-1 bg-[#0b0d14] rounded-full p-1 border border-white/20 shadow-md">
                    {getKindIcon(current.kind)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display font-bold text-base md:text-lg text-white leading-tight truncate">
                      {current.title}
                    </h4>
                    {current.actor?.handle && (
                      <span className="text-xs text-white/50 truncate shrink-0">
                        @{current.actor.handle}
                      </span>
                    )}
                  </div>

                  {current.message && (
                    <p className="text-sm text-white/90 leading-snug mt-1 line-clamp-3 font-normal">
                      {current.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Bar / Morphing Inline Reply Box */}
              <div className="mt-4 pt-3 border-t border-white/10">
                {replySent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-2 px-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    <span>Quick reply delivered!</span>
                  </motion.div>
                ) : isReplying ? (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    onSubmit={handleSendQuickReply}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={quickReplyText}
                      onChange={(e) => setQuickReplyText(e.target.value)}
                      placeholder="Type quick reply..."
                      className="flex-1 px-3.5 py-2 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-xs focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap"
                    />
                    <button
                      type="submit"
                      disabled={!quickReplyText.trim()}
                      className="p-2 rounded-xl bg-snap text-snap-foreground hover:brightness-105 disabled:opacity-40 transition"
                      aria-label="Send reply"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsReplying(false)}
                      className="p-2 rounded-xl bg-white/10 text-white/60 hover:text-white transition text-xs"
                    >
                      Cancel
                    </button>
                  </motion.form>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClick();
                      }}
                      className="flex-1 py-2 px-4 rounded-2xl bg-snap text-snap-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-md hover:brightness-105 active:scale-[0.98] transition"
                    >
                      <span>Open & View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {current.kind === "message" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsReplying(true);
                        }}
                        className="py-2 px-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.98]"
                      >
                        <CornerDownRight className="w-3.5 h-3.5 text-snap" />
                        <span>Quick Reply</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss();
                      }}
                      className="py-2 px-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {/* Auto-dismiss countdown bar */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-snap transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
