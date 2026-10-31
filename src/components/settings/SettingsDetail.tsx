import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  RotateCcw,
  Search,
  Star,
  Slash,
  Heart,
  MessageSquare,
  Repeat2,
  Clock,
  Bell,
  Tablet,
  EyeOff,
  Shield,
  KeyRound,
  ExternalLink,
  Check,
  Smartphone,
  Sliders,
  Volume2,
  Lock,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { useAppPrefs } from "@/lib/appPrefs";
import {
  formatDuration,
  readUsage,
  todaySeconds,
  weekAverageSeconds,
  clearGracePeriod,
} from "@/lib/usage";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { triggerNotchNotification } from "@/lib/notchNotification";
import { notificationAudio } from "@/lib/notificationAudio";
import { soundEngine, playSound } from "@/lib/soundEngine";
import { isOnlinePrivacyEnabled, setOnlinePrivacyEnabled } from "@/lib/presence";
import { MediaStoragePanel } from "./MediaStoragePanel";
import { AppUpdatesPanel } from "./AppUpdatesPanel";

export type SettingsPanel =
  | "saved"
  | "archive"
  | "activity"
  | "time"
  | "insights"
  | "privacy"
  | "closeFriends"
  | "blocked"
  | "notifications"
  | "tablet"
  | "hideStory"
  | "messages"
  | "mediaStorage"
  | "updates"
  | "tools";

const TITLES: Record<SettingsPanel, string> = {
  saved: "Saved Flicks",
  archive: "Archived Flicks",
  activity: "Your Activity",
  time: "Time Management",
  insights: "Creator Insights",
  privacy: "Account Privacy",
  closeFriends: "Close Friends",
  blocked: "Blocked Accounts",
  notifications: "Notifications",
  tablet: "Flick for Tablets & PC",
  hideStory: "Hide Story From",
  messages: "Messages & Story Replies",
  mediaStorage: "Media & Storage",
  updates: "App Updates & Hot Reload",
  tools: "Account Tools",
};

type RichPost = {
  id: string;
  content: string;
  image_url: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  author: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

type MiniProfile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

export function SettingsDetail({
  panel,
  onClose,
}: {
  panel: SettingsPanel | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs, update } = useAppPrefs();
  const [posts, setPosts] = useState<RichPost[]>([]);
  const [people, setPeople] = useState<MiniProfile[]>([]);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState({
    flicks: 0,
    likesGiven: 0,
    comments: 0,
    saved: 0,
    likesGot: 0,
    commentsGot: 0,
    resharesGot: 0,
  });
  const [loading, setLoading] = useState(false);
  const [pinDraft, setPinDraft] = useState(prefs.screenTimePin || "1234");
  const [editingPin, setEditingPin] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => notificationAudio.isVoiceEnabled());
  const [soundEffectEnabled, setSoundEffectEnabled] = useState(() => soundEngine.isSoundEnabled());
  const [onlinePrivacy, setOnlinePrivacy] = useState(() => isOnlinePrivacyEnabled());

  const usage = useMemo(() => readUsage(), [panel]);

  useEffect(() => {
    if (!panel || !user) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      // 1. Saved Flicks (Rich cards with author info and direct tap redirect)
      if (panel === "saved") {
        const { data: savedRows } = await supabase
          .from("saved_posts")
          .select("post_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const ids = (savedRows ?? []).map((r) => r.post_id);
        if (ids.length) {
          const { data: ps } = await supabase
            .from("posts")
            .select(
              "id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)"
            )
            .in("id", ids);

          if (!cancelled) setPosts((ps ?? []) as unknown as RichPost[]);
        } else {
          if (!cancelled) setPosts([]);
        }
      }

      // 2. Archived Flicks
      if (panel === "archive") {
        const ids = prefs.archivedPosts ?? [];
        if (ids.length) {
          const { data: ps } = await supabase
            .from("posts")
            .select(
              "id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)"
            )
            .in("id", ids);
          if (!cancelled) setPosts((ps ?? []) as unknown as RichPost[]);
        } else {
          if (!cancelled) setPosts([]);
        }
      }

      // 3. Activity / Insights
      if (panel === "activity" || panel === "insights") {
        const mine = await supabase.from("posts").select("id").eq("author_id", user.id);
        const myIds = (mine.data ?? []).map((p) => p.id);
        const [pc, lg, cm, sv, lr, cr, rr] = await Promise.all([
          supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
          supabase.from("likes").select("post_id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
          supabase.from("saved_posts").select("post_id", { count: "exact", head: true }).eq("user_id", user.id),
          myIds.length ? supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", myIds) : Promise.resolve({ count: 0 }),
          myIds.length ? supabase.from("comments").select("id", { count: "exact", head: true }).in("post_id", myIds) : Promise.resolve({ count: 0 }),
          myIds.length ? supabase.from("reshares").select("post_id", { count: "exact", head: true }).in("post_id", myIds) : Promise.resolve({ count: 0 }),
        ]);

        if (!cancelled) {
          setCounts({
            flicks: pc.count ?? 0,
            likesGiven: lg.count ?? 0,
            comments: cm.count ?? 0,
            saved: sv.count ?? 0,
            likesGot: lr.count ?? 0,
            commentsGot: cr.count ?? 0,
            resharesGot: rr.count ?? 0,
          });
        }
      }

      // 4. Close friends / Hide story / Blocked
      if (panel === "closeFriends" || panel === "hideStory") {
        const { data } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .neq("id", user.id)
          .limit(50);
        if (!cancelled) setPeople((data ?? []) as MiniProfile[]);
      }

      if (panel === "blocked") {
        const { data } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
        const ids = (data ?? []).map((b) => b.blocked_id);
        if (ids.length) {
          const { data: ps } = await supabase
            .from("profiles")
            .select("id, handle, display_name, avatar_url")
            .in("id", ids);
          if (!cancelled) setPeople((ps ?? []) as MiniProfile[]);
        } else {
          if (!cancelled) setPeople([]);
        }
      }

      if (!cancelled) setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [panel, user?.id]);

  const filteredPeople = people.filter(
    (p) =>
      !query ||
      p.handle.toLowerCase().includes(query.toLowerCase()) ||
      p.display_name.toLowerCase().includes(query.toLowerCase())
  );

  const unsaveFlick = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
    setPosts((ps) => ps.filter((p) => p.id !== postId));
    toast.success("Removed from Saved");
  };

  const unarchiveFlick = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    update({ archivedPosts: (prefs.archivedPosts ?? []).filter((id) => id !== postId) });
    setPosts((ps) => ps.filter((p) => p.id !== postId));
    toast.success("Restored to your profile");
  };

  const unblockPerson = async (id: string) => {
    if (!user) return;
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    setPeople((ps) => ps.filter((p) => p.id !== id));
    toast.success("Unblocked");
  };

  const toggleCloseFriend = (id: string) => {
    const set = new Set(prefs.closeFriends);
    set.has(id) ? set.delete(id) : set.add(id);
    update({ closeFriends: [...set] });
  };

  const toggleHideStory = (id: string) => {
    const set = new Set(prefs.hiddenStoryUsers || []);
    if (set.has(id)) {
      set.delete(id);
      toast.success("Story unhidden for this user");
    } else {
      set.add(id);
      toast.success("Story hidden from this user");
    }
    update({ hiddenStoryUsers: [...set] });
  };

  const savePin = () => {
    if (pinDraft.length !== 4 || !/^\d{4}$/.test(pinDraft)) {
      toast.error("Passcode must be exactly 4 digits");
      return;
    }
    update({ screenTimePin: pinDraft });
    setEditingPin(false);
    toast.success("Screen time passcode updated");
  };

  const testLockout = () => {
    clearGracePeriod();
    update({ dailyLimitMin: 1 });
    toast.success("Daily limit set to 1 min for testing. Lockout screen will appear!");
    onClose();
  };

  const sendTestNotification = () => {
    const title = "Ryder flicked you ⚡️";
    const body = "Hey! Testing your custom audio notification sounds.";
    if (typeof window !== "undefined" && window.electronAPI?.showNotification) {
      window.electronAPI.showNotification({ title, body, url: "/messages" });
      window.electronAPI.flashFrame();
    } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-512.png" });
    }
    triggerNotchNotification({
      kind: "message",
      title,
      message: body,
      url: "/messages",
      actor: {
        id: "demo-user-1",
        handle: "ryder",
        display_name: "Ryder",
      },
    });
    toast.success("Test notification & audio played!");
  };

  const redirectToFlick = (postId: string) => {
    onClose();
    navigate(`/?post=${postId}`);
  };

  const last7 = Object.keys(usage).sort().slice(-7);
  const peak = Math.max(1, ...last7.map((d) => usage[d] ?? 0));

  if (!panel) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-0 md:p-6 select-none"
      >
        <motion.div
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
          className="w-full h-full md:max-w-xl md:h-[88vh] md:max-h-[850px] bg-background md:rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3.5 flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-secondary transition text-muted-foreground hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg tracking-tight flex-1">{TITLES[panel]}</h1>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto pb-12">
            {loading && (
              <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-snap border-t-transparent rounded-full animate-spin" />
                <span>Loading {TITLES[panel]}…</span>
              </div>
            )}

            {/* ===== 1. SAVED FLICKS ===== */}
            {panel === "saved" && !loading && (
              <div>
                {posts.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30 text-snap" />
                    <p className="text-sm font-semibold text-foreground">No saved flicks yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tap the bookmark icon on any flick to keep it in your collection.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {posts.map((p) => {
                      const thumb = p.image_url || (p.media_type === "image" ? p.media_url : null);
                      const isVideo = p.media_type === "video";
                      return (
                        <li
                          key={p.id}
                          onClick={() => redirectToFlick(p.id)}
                          className="p-4 hover:bg-secondary/40 cursor-pointer transition flex gap-3.5 items-start group"
                        >
                          {/* Media Preview or Icon */}
                          <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden shrink-0 grid place-items-center relative border border-border">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                            ) : isVideo && p.media_url ? (
                              <video src={p.media_url} className="w-full h-full object-cover" muted />
                            ) : (
                              <Bookmark className="w-6 h-6 text-snap" />
                            )}
                          </div>

                          {/* Author & Content details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar url={p.author?.avatar_url} name={p.author?.display_name} size={22} />
                              <span className="text-xs font-semibold truncate text-foreground">
                                {p.author?.display_name || "Creator"}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate">
                                @{p.author?.handle || "user"}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90 line-clamp-2 leading-relaxed">
                              {p.content || (thumb ? "(Photo flick)" : isVideo ? "(Video reel)" : "(Flick)")}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                              <span className="text-snap font-medium flex items-center gap-1 group-hover:underline">
                                View flick <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={(e) => unsaveFlick(p.id, e)}
                            className="p-2 rounded-full hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition"
                            title="Remove from saved"
                          >
                            <Bookmark className="w-4 h-4 fill-current text-snap" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* ===== 2. ARCHIVE ===== */}
            {panel === "archive" && !loading && (
              <div>
                <p className="px-4 py-3 text-xs text-muted-foreground bg-secondary/30 border-b border-border">
                  Archived flicks stay hidden from your profile grid until you choose to restore them.
                </p>
                {posts.length === 0 ? (
                  <p className="p-10 text-center text-sm text-muted-foreground">No archived flicks.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {posts.map((p) => (
                      <li key={p.id} className="p-4 flex items-center gap-3 hover:bg-secondary/30 transition">
                        <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden shrink-0">
                          {p.image_url || p.media_url ? (
                            <img src={p.image_url || p.media_url!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-muted-foreground">Flick</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2">{p.content || "(media flick)"}</p>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => unarchiveFlick(p.id, e)}
                          className="px-3 py-1.5 rounded-full border border-border text-xs flex items-center gap-1.5 hover:bg-secondary transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ===== 2.5 CREATOR INSIGHTS & ACTIVITY ===== */}
            {(panel === "insights" || panel === "activity") && !loading && (
              <div className="p-4 space-y-4">
                <div className="card-glass rounded-2xl p-4 border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 to-background flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <span>Creator Insights Hub</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Flicks unique views, engagement trends & D3 activity heatmaps
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      navigate("/creator-insights");
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition shrink-0"
                  >
                    Open Dashboard →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground">Published Flicks</div>
                    <div className="font-display text-2xl font-bold mt-1 text-foreground">{counts.flicks}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground">Likes Received</div>
                    <div className="font-display text-2xl font-bold mt-1 text-emerald-400">{counts.likesGot}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground">Comments on Flicks</div>
                    <div className="font-display text-2xl font-bold mt-1 text-blue-400">{counts.commentsGot}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="text-xs text-muted-foreground">Reshares Received</div>
                    <div className="font-display text-2xl font-bold mt-1 text-snap">{counts.resharesGot}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    navigate("/creator-insights");
                  }}
                  className="w-full py-3 rounded-2xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-bold text-foreground flex items-center justify-center gap-2 transition"
                >
                  <BarChart3 className="w-4 h-4 text-snap" />
                  <span>View Interactive Recharts & D3 Heatmaps</span>
                </button>
              </div>
            )}

            {/* ===== 3. TIME MANAGEMENT ===== */}
            {panel === "time" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-card/60 p-4">
                    <Clock className="w-5 h-5 mb-2 text-snap" />
                    <div className="font-display text-3xl font-bold">{formatDuration(todaySeconds())}</div>
                    <div className="text-xs text-muted-foreground">Time spent today</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/60 p-4">
                    <Clock className="w-5 h-5 mb-2 text-muted-foreground" />
                    <div className="font-display text-3xl font-bold">{formatDuration(weekAverageSeconds())}</div>
                    <div className="text-xs text-muted-foreground">Daily average (7 days)</div>
                  </div>
                </div>

                {/* 7-day Bar Chart */}
                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Activity statistics (Last 7 Days)
                  </div>
                  <div className="flex items-end gap-2 h-28 pt-2">
                    {last7.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Start using Flick to track statistics.</p>
                    ) : (
                      last7.map((d) => {
                        const sec = usage[d] ?? 0;
                        const heightPct = Math.max(8, (sec / peak) * 100);
                        return (
                          <div key={d} className="flex-1 flex flex-col items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground">{Math.round(sec / 60)}m</span>
                            <div className="w-full bg-secondary/80 rounded-t-lg overflow-hidden h-20 flex items-end">
                              <div
                                className="w-full bg-snap rounded-t-lg transition-all duration-500 shadow-[0_0_10px_rgba(197,232,99,0.5)]"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                              {new Date(d).toLocaleDateString(undefined, { weekday: "narrow" })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Daily limit slider */}
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Daily Limit Reminder</div>
                      <div className="text-xs text-muted-foreground">TikTok-style lockout when exceeded</div>
                    </div>
                    <span className="text-sm font-mono font-bold text-snap">
                      {prefs.dailyLimitMin > 0 ? `${prefs.dailyLimitMin} mins` : "Off"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={15}
                    value={prefs.dailyLimitMin}
                    onChange={(e) => update({ dailyLimitMin: Number(e.target.value) })}
                    className="w-full accent-[hsl(var(--snap))]"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>Off</span>
                    <span>30m</span>
                    <span>1h</span>
                    <span>1h 30m</span>
                    <span>2h</span>
                    <span>3h</span>
                  </div>
                </div>

                {/* PIN Code Configuration */}
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-snap" />
                      <div>
                        <div className="text-sm font-semibold">Screen Time Passcode</div>
                        <div className="text-xs text-muted-foreground">Default passcode is 1234</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingPin(!editingPin)}
                      className="text-xs text-snap font-semibold hover:underline"
                    >
                      {editingPin ? "Cancel" : "Change PIN"}
                    </button>
                  </div>

                  {editingPin ? (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="password"
                        maxLength={4}
                        value={pinDraft}
                        onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ""))}
                        placeholder="1234"
                        className="bg-secondary px-3 py-2 rounded-xl text-center font-mono text-lg tracking-widest w-28 border border-border focus:outline-none focus:border-snap"
                      />
                      <button
                        onClick={savePin}
                        className="bg-snap text-snap-foreground rounded-xl px-4 py-2 font-bold text-xs"
                      >
                        Save PIN
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Active Passcode:</span>
                      <span className="font-mono font-bold text-foreground tracking-widest">
                        {prefs.screenTimePin ? "••••" : "1234"}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={testLockout}
                    className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5 text-snap" /> Preview TikTok-Style Lockout
                  </button>
                </div>
              </div>
            )}

            {/* ===== 4. NOTIFICATIONS ===== */}
            {panel === "notifications" && (
              <div className="p-4 space-y-3">
                <div className="rounded-2xl border border-border bg-card/60 p-4 mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Windows & Mobile Push Alerts</div>
                    <div className="text-xs text-muted-foreground">
                      Receives new flick notifications and background messages
                    </div>
                  </div>
                  <button
                    onClick={sendTestNotification}
                    className="bg-snap text-snap-foreground rounded-full px-3.5 py-1.5 text-xs font-bold shrink-0"
                  >
                    Test Alert
                  </button>
                </div>
                <div className="rounded-2xl border border-border bg-card/60 p-4 mb-2 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-snap" />
                      <span>Notification Chime (&ldquo;Faaaaah&rdquo; Sound)</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      The signature &ldquo;faaaaah&rdquo; audio chime played when receiving chats, reactions, or duels. You can turn it on or off anytime.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        playSound("notification_chime");
                        toast("Playing &lsquo;Faaaaah&rsquo; sound effect");
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-full bg-secondary text-foreground hover:bg-secondary/70 border border-border"
                    >
                      Test Sound
                    </button>
                    <input
                      type="checkbox"
                      checked={soundEffectEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setSoundEffectEnabled(val);
                        soundEngine.setSoundEnabled(val);
                        toast.success(
                          val ? "Notification 'Faaaaah' sound turned ON" : "Notification 'Faaaaah' sound turned OFF"
                        );
                      }}
                      className="w-5 h-5 accent-[hsl(var(--snap))] rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/60 p-4 mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-snap" />
                      <span>Voice Readouts & Spoken Notifications</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Speaks news headlines and creator flick updates (e.g. &ldquo;Jessy Jay posted: [flick summary]&rdquo;). You can toggle this off anytime.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => {
                      setVoiceEnabled(e.target.checked);
                      notificationAudio.setVoiceEnabled(e.target.checked);
                      toast.success(
                        e.target.checked ? "Voice readouts enabled" : "Voice readouts muted"
                      );
                    }}
                    className="w-5 h-5 accent-[hsl(var(--snap))] rounded cursor-pointer"
                  />
                </div>

                {[
                  { key: "notificationsDMs" as const, label: "Direct Messages & Chats", sub: "Notifications when flickers send you a message" },
                  { key: "notificationsLikes" as const, label: "Likes & Reactions", sub: "Alerts when someone likes or reacts to your flick" },
                  { key: "notificationsFlickers" as const, label: "New Flickers", sub: "When new creators follow and join your audience" },
                  { key: "notificationsComments" as const, label: "Comments & Replies", sub: "Discussions and replies on your content" },
                  { key: "notificationsStories" as const, label: "Stories from Flickers", sub: "When people you follow share 24h stories" },
                  { key: "newsPopups" as const, label: "In-App Breaking News", sub: "Non-intrusive floating headlines while browsing" },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 cursor-pointer hover:bg-card/60 transition">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.sub}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(prefs[item.key])}
                      onChange={(e) => update({ [item.key]: e.target.checked })}
                      className="w-5 h-5 accent-[hsl(var(--snap))] rounded cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            )}

            {/* ===== 5. FLICK FOR TABLETS & PC ===== */}
            {panel === "tablet" && (
              <div className="p-4 space-y-4">
                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tablet className="w-5 h-5 text-snap" />
                    <div className="font-semibold text-sm">Tablet & Big Screen Experience</div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Optimized for iPad, Android tablets, laptops, and foldables. Seamlessly adapts between single column touch and wide dual-column views.
                  </p>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 cursor-pointer">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Adaptive Split-Screen Layout</div>
                    <div className="text-xs text-muted-foreground">Feed and suggestions side-by-side on wide screens</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs.tabletAdaptiveLayout)}
                    onChange={(e) => update({ tabletAdaptiveLayout: e.target.checked })}
                    className="w-5 h-5 accent-[hsl(var(--snap))]"
                  />
                </label>

                <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Keyboard Shortcuts (Laptop & Tablet Keyboard)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 rounded-xl bg-secondary/50 font-mono">
                      <span>Next / Prev Flick</span>
                      <span className="font-bold text-snap">J / K</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-xl bg-secondary/50 font-mono">
                      <span>Like Flick</span>
                      <span className="font-bold text-snap">L</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-xl bg-secondary/50 font-mono">
                      <span>Save to Collection</span>
                      <span className="font-bold text-snap">S</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-xl bg-secondary/50 font-mono">
                      <span>Open DMs</span>
                      <span className="font-bold text-snap">M</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-xl bg-secondary/50 font-mono">
                      <span>Quick Search</span>
                      <span className="font-bold text-snap">/</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-xl bg-secondary/50 font-mono">
                      <span>Close Modals</span>
                      <span className="font-bold text-snap">Esc</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== 6. HIDE STORY FROM ===== */}
            {panel === "hideStory" && !loading && (
              <div>
                <p className="px-4 py-3 text-xs text-muted-foreground bg-secondary/30 border-b border-border">
                  Choose specific accounts who cannot view your 24h stories.
                </p>
                <div className="p-3">
                  <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search accounts"
                      className="bg-transparent text-sm flex-1 focus:outline-none"
                    />
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {filteredPeople.map((p) => {
                    const isHidden = (prefs.hiddenStoryUsers || []).includes(p.id);
                    return (
                      <li key={p.id} className="p-3.5 flex items-center gap-3 hover:bg-secondary/30 transition">
                        <Avatar url={p.avatar_url} name={p.display_name} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{p.display_name}</div>
                          <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                        </div>
                        <button
                          onClick={() => toggleHideStory(p.id)}
                          className={`text-xs px-3.5 py-1.5 rounded-full border transition font-medium ${
                            isHidden
                              ? "bg-destructive text-destructive-foreground border-transparent"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          {isHidden ? (
                            <span className="flex items-center gap-1">
                              <EyeOff className="w-3.5 h-3.5" /> Hidden
                            </span>
                          ) : (
                            "Hide Story"
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* ===== 7. MESSAGES AND STORY REPLIES ===== */}
            {panel === "messages" && (
              <div className="p-4 space-y-4">
                {/* DMs */}
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
                  <div className="text-sm font-semibold">Who can message you</div>
                  <div className="text-xs text-muted-foreground mb-3">Controls message requests in your inbox</div>
                  <div className="flex flex-wrap gap-2">
                    {(["everyone", "closeFriends", "nobody"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => update({ dmFrom: o })}
                        className={`px-3.5 py-2 rounded-xl text-xs border font-medium transition ${
                          prefs.dmFrom === o
                            ? "bg-snap text-snap-foreground border-transparent shadow-[0_0_12px_rgba(197,232,99,0.4)]"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        {o === "closeFriends" ? "Close Friends Only" : o === "everyone" ? "Everyone" : "Nobody"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Story replies */}
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
                  <div className="text-sm font-semibold">Story Replies & Reactions</div>
                  <div className="text-xs text-muted-foreground mb-3">Allow reactions and replies sent directly to DMs</div>
                  <div className="flex flex-wrap gap-2">
                    {(["everyone", "closeFriends", "off"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => update({ storyRepliesFrom: o })}
                        className={`px-3.5 py-2 rounded-xl text-xs border font-medium transition ${
                          prefs.storyRepliesFrom === o
                            ? "bg-snap text-snap-foreground border-transparent shadow-[0_0_12px_rgba(197,232,99,0.4)]"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        {o === "closeFriends" ? "Close Friends Only" : o === "everyone" ? "Allow for Everyone" : "Don't Allow"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Read receipts & activity */}
                <label className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 cursor-pointer">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Show Read Receipts</div>
                    <div className="text-xs text-muted-foreground">Let others see when you have read their messages</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs.readReceipts)}
                    onChange={(e) => update({ readReceipts: e.target.checked })}
                    className="w-5 h-5 accent-[hsl(var(--snap))]"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 cursor-pointer">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Show Activity Status</div>
                    <div className="text-xs text-muted-foreground">Allow accounts you follow to see when you are active</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs.showActivityStatus)}
                    onChange={(e) => update({ showActivityStatus: e.target.checked })}
                    className="w-5 h-5 accent-[hsl(var(--snap))]"
                  />
                </label>
              </div>
            )}

            {/* ===== 8. ACCOUNT PRIVACY ===== */}
            {panel === "privacy" && (
              <div className="p-4 space-y-3">
                {[
                  {
                    key: "privateAccount" as const,
                    label: "Private Account",
                    sub: "When your account is private, only flickers you approve can see your flicks and stories.",
                  },
                  {
                    key: "allowTags" as const,
                    label: "Allow Tags & Mentions",
                    sub: "Allow other creators to mention you in their flicks.",
                  },
                  {
                    key: "autoShareOnPost" as const,
                    label: "Quick Share Sheet on Post",
                    sub: "Automatically pop open share links right after publishing a flick.",
                  },
                ].map((t) => (
                  <label key={t.key} className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 cursor-pointer">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{t.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t.sub}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(prefs[t.key])}
                      onChange={(e) => update({ [t.key]: e.target.checked })}
                      className="w-5 h-5 accent-[hsl(var(--snap))]"
                    />
                  </label>
                ))}

                {/* WhatsApp-style Online Presence Indicator Toggle */}
                <label className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 cursor-pointer hover:bg-card/60 transition">
                  <div className="flex-1">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Show Online Status</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Show green &lsquo;Online&rsquo; indicator when you have active internet connection and are in the app (like WhatsApp double ticks and online badge).
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={onlinePrivacy}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setOnlinePrivacy(val);
                      setOnlinePrivacyEnabled(val);
                      toast.success(
                        val ? "Online status visible to friends" : "Online status hidden (Always offline)"
                      );
                    }}
                    className="w-5 h-5 accent-[hsl(var(--snap))]"
                  />
                </label>
              </div>
            )}

            {/* ===== 9. CLOSE FRIENDS & BLOCKED ===== */}
            {(panel === "closeFriends" || panel === "blocked") && !loading && (
              <div>
                {panel === "closeFriends" && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search flickers"
                        className="bg-transparent text-sm flex-1 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                <ul className="divide-y divide-border">
                  {filteredPeople.map((p) => (
                    <li key={p.id} className="p-3.5 flex items-center gap-3 hover:bg-secondary/30 transition">
                      <Avatar url={p.avatar_url} name={p.display_name} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{p.display_name}</div>
                        <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                      </div>
                      {panel === "blocked" ? (
                        <button
                          onClick={() => unblockPerson(p.id)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary"
                        >
                          <Slash className="w-3.5 h-3.5 inline mr-1" /> Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleCloseFriend(p.id)}
                          className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition ${
                            prefs.closeFriends.includes(p.id)
                              ? "bg-snap text-snap-foreground border-transparent"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 inline mr-1" />
                          {prefs.closeFriends.includes(p.id) ? "Added" : "Add"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ===== 10. MEDIA & STORAGE ===== */}
            {panel === "mediaStorage" && <MediaStoragePanel />}

            {/* ===== 11. IN-APP UPDATES & HOT RELOAD ===== */}
            {panel === "updates" && <AppUpdatesPanel />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
