import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  Heart,
  MessageCircle,
  AtSign,
  Camera,
  FileText,
  Trash2,
  Search,
  CheckCheck,
  Settings2,
  Archive,
  ChevronDown,
  BellOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNowStrict } from "date-fns";
import { Link } from "react-router-dom";
import { requestWebPushPermission, linkWebPushUser } from "@/lib/webPush";
import { Avatar } from "@/components/Avatar";
import { dedupe, sectionize, priorityOf, type NotifRow } from "@/lib/notifications/group";
import { useNotifPrefs, type NotifPrefs } from "@/lib/notifications/prefs";
import { toast } from "sonner";
import {
  triggerNotchNotification,
  getStoredNotchStyle,
  setStoredNotchStyle,
  type NotchStyle,
} from "@/components/notifications/NotchNotification";

const readPerm = (): NotificationPermission => {
  if (typeof window !== "undefined" && localStorage.getItem("flick:push-enabled") === "true") {
    return "granted";
  }
  return typeof Notification === "undefined" ? "default" : Notification.permission;
};

const FILTERS = ["All", "Unread", "Messages", "Mentions", "Posts", "Stories"] as const;
type Filter = (typeof FILTERS)[number];

const ARCHIVE_KEY = "flick:notif-archived";
const readArchive = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};
const writeArchive = (s: Set<string>) => {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* noop */
  }
};

const iconFor = (k: string) =>
  k === "like"
    ? Heart
    : k === "mention"
      ? AtSign
      : k === "story"
        ? Camera
        : k === "post"
          ? FileText
          : k === "comment" || k === "message"
            ? MessageCircle
            : Bell;

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-snap/20 text-snap border-snap/40",
  normal: "bg-secondary text-muted-foreground border-border",
  low: "bg-secondary/60 text-muted-foreground/80 border-border",
};

export const getReadCache = (userId: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(`flick:read_notifs_${userId}`) ?? "[]"));
  } catch {
    return new Set();
  }
};

export const saveReadCache = (userId: string, ids: string[]) => {
  try {
    const existing = getReadCache(userId);
    ids.forEach((i) => existing.add(i));
    localStorage.setItem(`flick:read_notifs_${userId}`, JSON.stringify([...existing].slice(-500)));
  } catch {
    /* noop */
  }
};

export function NotificationsInbox({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { prefs, update } = useNotifPrefs();
  const [items, setItems] = useState<NotifRow[]>([]);
  const [actors, setActors] = useState<
    Record<string, { handle: string; display_name: string; avatar_url: string | null }>
  >({});
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(readArchive);
  const [showPrefs, setShowPrefs] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>("default");
  const undoRef = useRef<NotifRow[] | null>(null);

  useEffect(() => {
    setPushPerm(readPerm());
  }, [open]);

  const enablePush = async () => {
    if (!user) return;
    try {
      await requestWebPushPermission();
      await linkWebPushUser(user.id);
    } catch {}

    localStorage.setItem("flick:push-enabled", "true");
    setPushPerm("granted");
    toast.success("Push & in-app notifications active!");
    triggerNotchNotification({
      kind: "system",
      title: "Notifications Enabled",
      message: "You'll now receive instant notifications everywhere across Flick ⚡️",
      actor: { id: "flick", handle: "flick", display_name: "Flick Notifications" },
    });
  };

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const readCache = getReadCache(user.id);
    const rows = ((data ?? []) as NotifRow[]).map((r) =>
      readCache.has(r.id) ? { ...r, read_at: r.read_at || new Date().toISOString() } : r
    );
    setItems(rows);
    const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,handle,display_name,avatar_url")
        .in("id", ids);
      const map: Record<
        string,
        { handle: string; display_name: string; avatar_url: string | null }
      > = {};
      for (const p of profs ?? []) map[p.id] = p;
      setActors(map);
    }
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    void load();
    const ch = supabase
      .channel(`inbox-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, user, load]);

  const ping = () => window.dispatchEvent(new Event("flick:notifications-updated"));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dedupe(items).filter((n) => {
      if (archived.has(n.id)) return false;
      if (q && !`${n.title} ${n.body ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "Unread") return !n.read_at;
      if (filter === "Stories") return n.kind === "story";
      if (filter === "Mentions") return n.kind === "mention";
      if (filter === "Posts") return ["post", "like", "comment"].includes(n.kind);
      if (filter === "Messages") return n.kind === "message";
      return true;
    });
  }, [items, filter, query, archived]);

  const sections = useMemo(() => sectionize(visible), [visible]);
  const unreadTotal = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    if (user) saveReadCache(user.id, ids);
    setItems((xs) =>
      xs.map((x) => (ids.includes(x.id) ? { ...x, read_at: x.read_at || now } : x)),
    );
    ping();
    await supabase.from("notifications").update({ read_at: now }).in("id", ids);
    ping();
  };

  const markAllRead = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const allIds = items.map((x) => x.id);
    saveReadCache(user.id, allIds);
    setItems((xs) => xs.map((x) => ({ ...x, read_at: x.read_at || now })));
    ping();
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
    ping();
    toast.success("All caught up! All notifications marked as read 🎉");
  };

  const remove = async (ids: string[]) => {
    if (!ids.length) return;
    undoRef.current = items.filter((x) => ids.includes(x.id));
    setItems((xs) => xs.filter((x) => !ids.includes(x.id)));
    setSelected(new Set());
    ping();
    await supabase.from("notifications").delete().in("id", ids);
    ping();
    toast("Deleted", {
      description: `${ids.length} notification${ids.length > 1 ? "s" : ""} removed`,
      action: {
        label: "Undo",
        onClick: async () => {
          const rows = undoRef.current ?? [];
          if (!rows.length) return;
          setItems((xs) =>
            [...rows, ...xs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
          );
          await supabase.from("notifications").insert(rows.map(({ ...r }) => r) as never);
          ping();
        },
      },
    });
  };

  const archive = (ids: string[]) => {
    const next = new Set(archived);
    ids.forEach((i) => next.add(i));
    setArchived(next);
    writeArchive(next);
    setSelected(new Set());
    toast("Archived", {
      action: {
        label: "Undo",
        onClick: () => {
          const back = new Set(next);
          ids.forEach((i) => back.delete(i));
          setArchived(back);
          writeArchive(back);
        },
      },
    });
  };

  const toggleSelect = (ids: string[]) => {
    setSelected((s) => {
      const next = new Set(s);
      const allIn = ids.every((i) => next.has(i));
      ids.forEach((i) => (allIn ? next.delete(i) : next.add(i)));
      return next;
    });
  };

  const selecting = selected.size > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex justify-end"
        >
          <motion.aside
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-[100dvh] bg-card border-l-2 border-border flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header
              className="px-4 pt-4 pb-3 border-b-2 border-border shrink-0"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bell className="w-5 h-5 text-snap" />
                  {unreadTotal > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-snap" />
                  )}
                </div>
                <h2 className="font-display text-lg uppercase tracking-tight flex-1 min-w-0 truncate">
                  Notifications
                  {unreadTotal > 0 && <span className="text-snap"> · {unreadTotal}</span>}
                </h2>
                <button
                  onClick={() => setShowPrefs((v) => !v)}
                  className="w-11 h-11 grid place-items-center text-muted-foreground hover:text-foreground"
                  aria-label="Notification settings"
                >
                  <Settings2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="w-11 h-11 grid place-items-center"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-secondary rounded-xl px-3 h-10 min-w-0">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search notifications"
                    className="bg-transparent outline-none text-sm flex-1 min-w-0 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  onClick={markAllRead}
                  title="Mark all notifications as read"
                  className="px-3 h-10 rounded-xl bg-secondary hover:bg-snap hover:text-snap-foreground flex items-center gap-1.5 text-xs font-bold transition text-muted-foreground shrink-0"
                >
                  <CheckCheck className="w-4 h-4 text-snap group-hover:text-current" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              </div>

              {pushPerm !== "granted" && (
                <button
                  onClick={enablePush}
                  className="mt-3 w-full h-10 rounded-xl bg-snap text-snap-foreground text-sm font-bold uppercase tracking-wide"
                >
                  Enable push notifications
                </button>
              )}
            </header>

            {/* Preferences panel */}
            <AnimatePresence>
              {showPrefs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b-2 border-border overflow-hidden shrink-0"
                >
                  <PrefsPanel
                    prefs={prefs}
                    update={update}
                    onAddDemoItem={(item) => {
                      setItems((prev) => [item, ...prev]);
                      ping();
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filters */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 border-b border-border shrink-0">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 h-8 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition ${
                    filter === f
                      ? "bg-snap text-snap-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Bulk action bar */}
            <AnimatePresence>
              {selecting && (
                <motion.div
                  initial={{ y: -12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2 bg-snap/10 border-b border-snap/30 shrink-0"
                >
                  <span className="text-xs font-bold text-snap">{selected.size} selected</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => void markRead([...selected])}
                    className="px-2 h-9 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Read
                  </button>
                  <button
                    onClick={() => archive([...selected])}
                    className="px-2 h-9 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => void remove([...selected])}
                    className="px-2 h-9 text-xs font-semibold text-destructive"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="w-9 h-9 grid place-items-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {sections.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-20 px-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-snap/20 text-snap grid place-items-center mx-auto">
                    <CheckCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-foreground text-base">
                    {filter === "Unread" ? "You're all caught up!" : "No notifications yet"}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {filter === "Unread"
                      ? "You have no unread notifications. New flicks, mentions and DMs will appear right here."
                      : "Likes, comments, mentions and DMs land here in real time."}
                  </p>
                  {filter === "Unread" && (
                    <button
                      onClick={() => setFilter("All")}
                      className="px-4 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition"
                    >
                      View all notifications
                    </button>
                  )}
                </div>
              )}
              {sections.map((section) => (
                <section key={section.label}>
                  <div className="sticky top-0 z-10 px-4 py-1.5 bg-card/95 backdrop-blur text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                    {section.label}
                  </div>
                  <ul>
                    {section.groups.map((g) => {
                      const ids = g.items.map((i) => i.id);
                      const isOpen = expanded.has(g.key);
                      const rows = isOpen ? g.items : [g.head];
                      return (
                        <li key={g.key}>
                          {rows.map((n, idx) => (
                            <NotifCard
                              key={n.id}
                              n={n}
                              actor={n.actor_id ? actors[n.actor_id] : undefined}
                              count={idx === 0 && !isOpen ? g.count : 1}
                              unreadCount={g.unread}
                              selected={selected.has(n.id)}
                              selecting={selecting}
                              onSelect={() => toggleSelect(idx === 0 && !isOpen ? ids : [n.id])}
                              onOpenGroup={
                                g.count > 1 && idx === 0
                                  ? () =>
                                      setExpanded((s) => {
                                        const next = new Set(s);
                                        if (next.has(g.key)) next.delete(g.key);
                                        else next.add(g.key);
                                        return next;
                                      })
                                  : undefined
                              }
                              expanded={isOpen}
                              onRead={() => void markRead([n.id])}
                              onArchive={() => archive([n.id])}
                              onDelete={() => void remove([n.id])}
                              onNavigate={onClose}
                            />
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <div className="h-8" />
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Notification card with swipe gestures ---------------- */

function NotifCard({
  n,
  actor,
  count,
  unreadCount,
  selected,
  selecting,
  expanded,
  onSelect,
  onOpenGroup,
  onRead,
  onArchive,
  onDelete,
  onNavigate,
}: {
  n: NotifRow;
  actor?: { handle: string; display_name: string; avatar_url: string | null };
  count: number;
  unreadCount: number;
  selected: boolean;
  selecting: boolean;
  expanded: boolean;
  onSelect: () => void;
  onOpenGroup?: () => void;
  onRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const Icon = iconFor(n.kind);
  const unread = !n.read_at;
  const prio = priorityOf(n.kind);
  const name = actor?.display_name ?? n.title;

  const body = (
    <div
      className={`flex gap-3 px-4 py-3 border-b border-border transition ${unread ? "bg-snap/[0.06]" : ""} ${selected ? "bg-snap/15" : "hover:bg-secondary/40"}`}
    >
      <div className="relative shrink-0">
        <Avatar url={actor?.avatar_url} name={name} size={42} ring={unread} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full grid place-items-center border ${PRIORITY_STYLE[prio]}`}
        >
          <Icon className="w-2.5 h-2.5" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold break-words line-clamp-2">
          {n.title}
          {count > 1 && <span className="ml-1 text-snap font-bold">({count})</span>}
        </div>
        {n.body && (
          <div className="text-xs text-muted-foreground line-clamp-2 break-words">{n.body}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground/70">
            {formatDistanceToNowStrict(new Date(n.created_at))} ago
          </span>
          {prio === "high" && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-snap">
              Priority
            </span>
          )}
          {count > 1 && unreadCount > 0 && (
            <span className="text-[9px] font-bold text-snap">{unreadCount} new</span>
          )}
        </div>
      </div>
      {onOpenGroup && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenGroup();
          }}
          className="w-9 h-9 grid place-items-center shrink-0 text-muted-foreground"
          aria-label="Expand group"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
      {unread && !onOpenGroup && <span className="w-2 h-2 rounded-full bg-snap mt-2 shrink-0" />}
    </div>
  );

  return (
    <div className="relative overflow-hidden">
      {/* swipe action backdrops */}
      <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-snap">
          <Archive className="w-4 h-4" />
          Archive
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-destructive">
          Delete
          <Trash2 className="w-4 h-4" />
        </span>
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={(_, info) => {
          if (info.offset.x > 110) onArchive();
          else if (info.offset.x < -110) onDelete();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect();
        }}
        className="relative bg-card"
      >
        {selecting || !n.url ? (
          <div onClick={() => (selecting ? onSelect() : onRead())} className="cursor-pointer">
            {body}
          </div>
        ) : (
          <Link
            to={n.url}
            onClick={() => {
              onRead();
              onNavigate();
            }}
          >
            {body}
          </Link>
        )}
      </motion.div>
    </div>
  );
}

/* ---------------- Preferences ---------------- */

const TOGGLES: { key: keyof NotifPrefs; label: string }[] = [
  { key: "message", label: "Messages" },
  { key: "mention", label: "Mentions" },
  { key: "comment", label: "Comments" },
  { key: "like", label: "Likes" },
  { key: "story", label: "Stories" },
  { key: "post", label: "New flicks" },
  { key: "sound", label: "Sound" },
  { key: "vibrate", label: "Vibration" },
];

function PrefsPanel({
  prefs,
  update,
  onAddDemoItem,
}: {
  prefs: NotifPrefs;
  update: (p: Partial<NotifPrefs>) => void;
  onAddDemoItem?: (item: any) => void;
}) {
  const [currentStyle, setCurrentStyle] = useState<NotchStyle>(getStoredNotchStyle);

  const switchStyle = (s: NotchStyle) => {
    setCurrentStyle(s);
    setStoredNotchStyle(s);
    toast.success(`Switched notch style to ${s.toUpperCase()}`);
  };

  const simulateNotch = (kind: "message" | "like" | "story" | "live") => {
    const demoActors = [
      {
        id: "u-1",
        handle: "sarah_k",
        display_name: "Sarah Kim",
        avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
      },
      {
        id: "u-2",
        handle: "marcus_dev",
        display_name: "Marcus Vance",
        avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
      },
      {
        id: "u-3",
        handle: "elena_sound",
        display_name: "Elena Rostova",
        avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face",
      },
    ];

    let title = "";
    let message = "";
    let url = "/";
    const actor = demoActors[Math.floor(Math.random() * demoActors.length)];

    if (kind === "message") {
      title = `${actor.display_name} sent a message`;
      message = "Hey! Did you see the new fluid animation update on Flick? 🔥";
      url = `/messages/${actor.id}`;
    } else if (kind === "like") {
      title = `${actor.display_name} liked your flick`;
      message = "Your golden hour photo set received a reaction! 💖";
      url = "/";
    } else if (kind === "story") {
      title = `${actor.display_name} added a new story`;
      message = "Tap to view full-screen story highlights 📸";
      url = "/";
    } else if (kind === "live") {
      title = `${actor.display_name} is recording audio live`;
      message = "Broadcasting creator voice note · 0:14 📻";
      url = "/";
    }

    triggerNotchNotification({
      kind: kind === "live" ? "system" : kind,
      title,
      message,
      url,
      actor,
    });

    if (onAddDemoItem) {
      onAddDemoItem({
        id: `demo-${Date.now()}`,
        kind: kind === "live" ? "message" : kind,
        title,
        body: message,
        url,
        actor_id: actor.id,
        created_at: new Date().toISOString(),
        read_at: null,
      });
    }
  };

  return (
    <div className="px-4 py-3 space-y-3 bg-secondary/30">
      {/* In-App Notification Style Customizer */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-snap">
            In-App Notification Style
          </span>
          <span className="text-[10px] font-mono uppercase text-muted-foreground px-2 py-0.5 rounded bg-secondary">
            {currentStyle}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: "island", label: "🟢 Floating Capsule", desc: "Sleek floating pill" },
            { id: "notch", label: "💬 Top Notification Bar", desc: "Clean header bar" },
            { id: "expanded", label: "📱 Expanded Banner", desc: "Full card with quick action" },
            { id: "glow", label: "✨ Glow Capsule", desc: "Frosted color halo" },
            { id: "live", label: "📻 Live Activity", desc: "Equalizer & waveform" },
            { id: "minimal", label: "⚡ Minimal Pill", desc: "Ultra-compact badge" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => switchStyle(s.id as NotchStyle)}
              className={`p-2 rounded-xl text-left transition border ${
                currentStyle === s.id
                  ? "bg-snap/20 border-snap text-foreground ring-1 ring-snap/30"
                  : "bg-secondary/60 border-border/50 text-muted-foreground hover:bg-secondary"
              }`}
            >
              <div className="text-xs font-bold truncate leading-tight">{s.label}</div>
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Instant Push Simulator */}
      <div className="pt-2 border-t border-border/60 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Simulate Incoming Notification
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => simulateNotch("message")}
            className="h-8 rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-semibold flex items-center justify-center gap-1.5 text-purple-300 transition"
          >
            💬 Direct Message
          </button>
          <button
            onClick={() => simulateNotch("like")}
            className="h-8 rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-semibold flex items-center justify-center gap-1.5 text-pink-300 transition"
          >
            💖 Like Reaction
          </button>
          <button
            onClick={() => simulateNotch("story")}
            className="h-8 rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-semibold flex items-center justify-center gap-1.5 text-cyan-300 transition"
          >
            📸 New Story
          </button>
          <button
            onClick={() => simulateNotch("live")}
            className="h-8 rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-semibold flex items-center justify-center gap-1.5 text-snap transition"
          >
            📻 Live Equalizer
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-border/60 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Preferences
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {TOGGLES.map((t) => {
            const on = prefs[t.key] as boolean;
            return (
              <button
                key={t.key}
                onClick={() => update({ [t.key]: !on } as Partial<NotifPrefs>)}
                className={`h-10 rounded-xl px-3 text-xs font-semibold text-left flex items-center justify-between ${
                  on ? "bg-snap/15 text-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                <span className="truncate">{t.label}</span>
                <span
                  className={`w-8 h-4 rounded-full relative shrink-0 ${on ? "bg-snap" : "bg-muted-foreground/30"}`}
                >
                  <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-background transition-all ${on ? "left-4" : "left-0.5"}`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => update({ quietHours: !prefs.quietHours })}
        className={`w-full h-10 rounded-xl px-3 text-xs font-semibold flex items-center justify-between ${
          prefs.quietHours ? "bg-snap/15 text-foreground" : "bg-secondary text-muted-foreground"
        }`}
      >
        <span>
          Quiet hours · {String(prefs.quietFrom).padStart(2, "0")}:00 –{" "}
          {String(prefs.quietTo).padStart(2, "0")}:00
        </span>
        <span
          className={`w-8 h-4 rounded-full relative shrink-0 ${prefs.quietHours ? "bg-snap" : "bg-muted-foreground/30"}`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-background transition-all ${prefs.quietHours ? "left-4" : "left-0.5"}`}
          />
        </span>
      </button>
    </div>
  );
}
