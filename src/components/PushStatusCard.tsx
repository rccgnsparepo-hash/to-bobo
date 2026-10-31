import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, BellRing, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { initWebPush, requestWebPushPermission, linkWebPushUser } from "@/lib/webPush";
import { useAuth } from "@/lib/auth";
import {
  triggerNotchNotification,
  getStoredNotchStyle,
  setStoredNotchStyle,
  type NotchStyle,
} from "@/lib/notchNotification";

type Status = "unsupported" | "default" | "granted" | "denied";

function readPermission(): Status {
  if (typeof window === "undefined") return "unsupported";
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission as Status;
}

export function PushStatusCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>(readPermission);
  const [busy, setBusy] = useState(false);
  const [notchStyle, setNotchStyle] = useState<NotchStyle>(getStoredNotchStyle);

  const refresh = useCallback(() => setStatus(readPermission()), []);

  useEffect(() => {
    refresh();
    void initWebPush();
    const onVis = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      await requestWebPushPermission();
      if (user?.id) await linkWebPushUser(user.id);
      refresh();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        toast.success("Push notifications enabled on this device!");
        triggerNotchNotification({
          kind: "system",
          title: "Push Active",
          message: "You will receive message alerts even when Flick is closed ⚡️",
          actor: { id: "flick", handle: "flick", display_name: "Flick System" },
        });
      } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        toast.error("Notifications are blocked in your browser/device settings.");
      }
    } finally {
      setBusy(false);
    }
  };

  const testAlert = () => {
    triggerNotchNotification({
      kind: "message",
      title: "Sarah Kim sent a message",
      message: "Hey! Let's connect on Flick ⚡️",
      url: "/messages",
      actor: {
        id: "u-1",
        handle: "sarah_k",
        display_name: "Sarah Kim",
        avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
      },
    });
    toast.success("Triggered notification alert!");
  };

  const meta = {
    granted: {
      label: "Enabled",
      tone: "text-snap",
      Icon: BellRing,
      sub: "You'll receive push & in-app alerts",
    },
    denied: {
      label: "Blocked",
      tone: "text-destructive",
      Icon: BellOff,
      sub: "Allow notifications in browser site settings",
    },
    default: {
      label: "Active",
      tone: "text-snap",
      Icon: BellRing,
      sub: "Instant in-app notifications enabled",
    },
    unsupported: {
      label: "In-App Active",
      tone: "text-snap",
      Icon: BellRing,
      sub: "In-app notifications enabled",
    },
  }[status];

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <meta.Icon className={`w-5 h-5 ${meta.tone}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            Notifications
            <span className={`text-[10px] uppercase tracking-wider ${meta.tone}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.sub}</p>
        </div>
        {status !== "granted" && status !== "unsupported" && (
          <button
            onClick={enable}
            disabled={busy || status === "denied"}
            className="shrink-0 rounded-full bg-snap text-snap-foreground text-xs font-semibold px-4 py-2 disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {status === "denied" ? "Blocked" : "Enable"}
          </button>
        )}
      </div>

      {/* In-App Notification Quick Controls */}
      <div className="pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground">Banner style:</span>
          {(["island", "notch", "expanded", "glow", "live", "minimal"] as NotchStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setNotchStyle(s);
                setStoredNotchStyle(s);
                toast.success(`Switched banner style to ${s.toUpperCase()}`);
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold transition ${
                notchStyle === s
                  ? "bg-snap text-black"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "notch" ? "bar" : s}
            </button>
          ))}
        </div>
        <button
          onClick={testAlert}
          className="px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-bold text-snap flex items-center gap-1 transition"
        >
          <Sparkles className="w-3 h-3" />
          Test Alert
        </button>
      </div>
    </div>
  );
}
