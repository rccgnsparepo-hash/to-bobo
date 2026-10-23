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
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { notificationAudio } from "@/lib/notificationAudio";

export type NotchStyle = "island" | "expanded" | "glow" | "live" | "notch" | "minimal";

export type NotchNotificationItem = {
  id: string;
  kind: "post" | "message" | "story" | "comment" | "like" | "mention" | "system";
  title: string;
  message?: string;
  url?: string;
  actor?: {
    id?: string;
    handle?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  timestamp?: number;
  data?: Record<string, unknown>;
};

const STYLE_STORAGE_KEY = "flick:notch-style";

export function getStoredNotchStyle(): NotchStyle {
  try {
    const s = localStorage.getItem(STYLE_STORAGE_KEY) as NotchStyle;
    if (s && ["island", "expanded", "glow", "live", "notch", "minimal"].includes(s)) return s;
  } catch {}
  return "island";
}

export function setStoredNotchStyle(style: NotchStyle) {
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, style);
    window.dispatchEvent(new CustomEvent("flick:notch-style-changed", { detail: style }));
  } catch {}
}

/** Synthesize a subtle, pleasant notification chime */
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(1046.5, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12);

    osc2.frequency.setValueAtTime(1567.98, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(2093.0, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.04);
    osc1.stop(now + 0.38);
    osc2.stop(now + 0.38);
  } catch {}
}

/** Dispatches an in-app notification banner */
export function triggerNotchNotification(item: Omit<NotchNotificationItem, "id" | "timestamp"> & { id?: string }) {
  const fullItem: NotchNotificationItem = {
    id: item.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...item,
  };
  window.dispatchEvent(new CustomEvent("flick:notification-notch", { detail: fullItem }));

  // Also trigger system browser notification if allowed
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(fullItem.title, {
        body: fullItem.message || "New activity on Flick",
        icon: fullItem.actor?.avatar_url || "/icon-192.png",
      });
    } catch {}
  }
}

export function NotchNotification() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<NotchNotificationItem | null>(null);
  const [style, setStyle] = useState<NotchStyle>(getStoredNotchStyle);
  const dismissTimerRef = useRef<number | null>(null);

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
      setCurrent(item);
      void notificationAudio.playNotificationAudio(item.kind, item.actor);

      try {
        if ("vibrate" in navigator) navigator.vibrate([25, 40, 25]);
      } catch {}

      // Auto dismiss after 5.5 seconds
      dismissTimerRef.current = window.setTimeout(() => {
        setCurrent(null);
      }, 5500);
    };

    window.addEventListener("flick:notification-notch", handleNotchEvent);
    return () => {
      window.removeEventListener("flick:notification-notch", handleNotchEvent);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const dismiss = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setCurrent(null);
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

  const getKindIcon = (k: string) => {
    switch (k) {
      case "like":
        return <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />;
      case "message":
        return <MessageCircle className="w-3.5 h-3.5 text-purple-400 fill-purple-400/30" />;
      case "story":
        return <Camera className="w-3.5 h-3.5 text-cyan-400" />;
      case "mention":
        return <AtSign className="w-3.5 h-3.5 text-yellow-400" />;
      case "post":
        return <FileText className="w-3.5 h-3.5 text-snap" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-snap" />;
    }
  };

  const getAccentColor = (k: string) => {
    switch (k) {
      case "like":
        return "border-pink-500/40 shadow-[0_0_24px_rgba(244,114,182,0.35)]";
      case "message":
        return "border-purple-500/40 shadow-[0_0_24px_rgba(168,85,247,0.35)]";
      case "story":
        return "border-cyan-500/40 shadow-[0_0_24px_rgba(6,182,212,0.35)]";
      case "mention":
        return "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.35)]";
      default:
        return "border-snap/40 shadow-[0_0_24px_rgba(197,232,99,0.35)]";
    }
  };

  return (
    <div className="fixed top-2 md:top-3 inset-x-0 z-[120] pointer-events-none flex justify-center px-3">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -45, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.92 }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 30,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -20) dismiss();
            }}
            className="pointer-events-auto cursor-pointer max-w-[94vw] md:max-w-md w-auto"
          >
            {/* VARIANT 1: SLEEK FLOATING PILL */}
            {style === "island" && (
              <div
                onClick={handleClick}
                className="bg-[#0b0b0d] text-white rounded-2xl py-2 px-3.5 shadow-2xl border border-white/15 flex items-center gap-3 backdrop-blur-2xl transition-all hover:ring-2 hover:ring-snap/30 group"
              >
                {/* Avatar with event badge */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <Avatar
                    url={current.actor?.avatar_url}
                    name={current.actor?.display_name || current.actor?.handle || "User"}
                    size={32}
                  />
                  <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 border border-white/20">
                    {getKindIcon(current.kind)}
                  </div>
                </div>

                {/* Title & snippet */}
                <div className="min-w-0 flex-1 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs leading-none truncate text-white">
                      {current.title}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-snap shrink-0 animate-pulse" />
                  </div>
                  {current.message && (
                    <p className="text-[11px] text-white/70 truncate mt-0.5 leading-snug">
                      {current.message}
                    </p>
                  )}
                </div>

                {/* View button & Dismiss */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold text-snap px-2 py-0.5 rounded-full bg-snap/15 group-hover:bg-snap group-hover:text-black transition">
                    View
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss();
                    }}
                    className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* VARIANT 2: EXPANDED CARD BANNER */}
            {style === "expanded" && (
              <div
                onClick={handleClick}
                className="bg-[#0f0f13]/95 text-white rounded-2xl p-3.5 shadow-2xl border border-white/20 backdrop-blur-3xl space-y-2.5 transition-all hover:border-white/30"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-snap animate-pulse" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-white/70">
                      Notification
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss();
                    }}
                    className="p-1 text-white/50 hover:text-white rounded-full"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Message body with avatar */}
                <div className="flex items-start gap-3">
                  <Avatar
                    url={current.actor?.avatar_url}
                    name={current.actor?.display_name || "User"}
                    size={38}
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      {current.title}
                      {getKindIcon(current.kind)}
                    </h4>
                    {current.message && (
                      <p className="text-xs text-white/80 line-clamp-2 mt-0.5">
                        {current.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                    className="flex-1 py-1.5 rounded-full bg-snap text-snap-foreground text-xs font-bold flex items-center justify-center gap-1 shadow-md hover:opacity-90 transition"
                  >
                    <span>Open</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss();
                    }}
                    className="py-1.5 px-3 rounded-full bg-white/10 hover:bg-white/15 text-xs text-white/80 font-medium transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* VARIANT 3: GLOW CAPSULE */}
            {style === "glow" && (
              <div
                onClick={handleClick}
                className={`bg-black/90 text-white rounded-full py-2 px-4 shadow-2xl border backdrop-blur-2xl flex items-center gap-3 transition-all ${getAccentColor(
                  current.kind
                )}`}
              >
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  {getKindIcon(current.kind)}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs text-white block truncate">
                    {current.title}
                  </span>
                  {current.message && (
                    <span className="text-[11px] text-white/70 block truncate">
                      {current.message}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-snap animate-ping" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss();
                    }}
                    className="text-white/40 hover:text-white p-1"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* VARIANT 4: LIVE ACTIVITY WAVEFORM */}
            {style === "live" && (
              <div
                onClick={handleClick}
                className="bg-[#08080a] text-white rounded-2xl py-2 px-4 shadow-2xl border border-snap/40 backdrop-blur-2xl flex items-center gap-3.5"
              >
                <div className="flex items-center gap-1 shrink-0">
                  <Radio className="w-4 h-4 text-snap animate-pulse" />
                  <div className="flex items-end gap-0.5 h-4 w-5">
                    <span className="w-1 bg-snap rounded-full h-3 animate-pulse" />
                    <span
                      className="w-1 bg-snap rounded-full h-4 animate-pulse"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1 bg-snap rounded-full h-2 animate-pulse"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {current.title}
                  </div>
                  {current.message && (
                    <div className="text-[11px] text-white/70 truncate">
                      {current.message}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                    now
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss();
                    }}
                    className="text-white/40 hover:text-white p-1"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* VARIANT 5: CLEAN TOP NOTIFICATION BAR (NO HARDWARE NOTCH CUTOUT OR IOS TEXT) */}
            {style === "notch" && (
              <div
                onClick={handleClick}
                className="bg-[#0a0a0c] text-white rounded-2xl px-4 py-2.5 shadow-2xl border border-white/20 backdrop-blur-3xl min-w-[280px] max-w-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar
                      url={current.actor?.avatar_url}
                      name={current.actor?.display_name || "User"}
                      size={34}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 border border-white/20">
                      {getKindIcon(current.kind)}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs leading-none truncate text-white">
                        {current.title}
                      </span>
                    </div>
                    {current.message && (
                      <p className="text-[11px] text-white/70 truncate mt-1 leading-snug">
                        {current.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-black bg-snap px-2.5 py-1 rounded-full hover:opacity-90">
                      Open
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss();
                      }}
                      className="p-1 text-white/40 hover:text-white"
                      aria-label="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VARIANT 6: MINIMAL SLIM CAPSULE */}
            {style === "minimal" && (
              <div
                onClick={handleClick}
                className="bg-[#09090b]/95 text-white rounded-full py-1.5 px-3 shadow-2xl border border-white/20 backdrop-blur-2xl flex items-center gap-2.5 hover:border-snap/40 transition"
              >
                <div className="relative shrink-0">
                  <Avatar
                    url={current.actor?.avatar_url}
                    name={current.actor?.display_name || "User"}
                    size={24}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-xs text-white truncate block max-w-[200px]">
                    {current.title}
                  </span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-snap animate-ping shrink-0" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                  }}
                  className="text-white/40 hover:text-white p-0.5"
                  aria-label="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
