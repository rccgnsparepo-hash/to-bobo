import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  MessageCircle,
  User,
  LogOut,
  BookOpen,
  Newspaper,
  Plus,
  Bell,
  Camera,
  MoreHorizontal,
  Trophy,
  BarChart3,
  X,
  Type,
  WifiOff,
  Building2,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenantContext";
import { WorkspaceSwitcherModal } from "./workspace/WorkspaceSwitcherModal";
import { Avatar } from "./Avatar";
import { AnimatePresence, motion } from "framer-motion";
import { CoachMark } from "./CoachMark";
import { ScrollHint } from "./ScrollHint";
import { NotificationsInbox } from "./NotificationsInbox";
import { GlobalAudioOverlay } from "./GlobalAudioOverlay";
import { initOfflineEngine } from "@/lib/offlineManager";
import { useHomeCameraSwipe } from "@/hooks/useHomeCameraSwipe";
import { triggerLightHaptic } from "@/lib/haptics";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initWebPush, linkWebPushUser, unlinkWebPushUser } from "@/lib/webPush";
import { initOneSignal, loginPushUser, logoutPushUser } from "@/lib/native/onesignal";
import { setupNativeAndroidPush } from "@/lib/native/nativePush";
import { startNewsNotificationChannel } from "@/lib/news";
import { bindNotificationRouter } from "@/lib/native/appLifecycle";
import { payloadToPath, navigateOnce, type NotifPayload } from "@/lib/native/deepLink";
import { setGlobalBadge } from "@/lib/notifications/badge";
import { useLenis } from "@/lib/useLenis";
import { initRealtimePushEngine, requestDesktopNotificationPermission } from "@/lib/realtimeNotifications";
const RightRail = lazy(() => import("./layout/RightRail").then((m) => ({ default: m.RightRail })));

const tabs: { to: string; icon: typeof Home; label: string; center?: boolean }[] = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/news", icon: Newspaper, label: "News" },
  { to: "/stories/new", icon: Plus, label: "Flick", center: true },
  { to: "/messages", icon: MessageCircle, label: "DMs" },
  { to: "/profile", icon: User, label: "Me" },
];

export function AppShell() {
  const { pathname } = useLocation();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useLenis(viewportRef);
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();
  const { currentTenant } = useTenant();
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useHomeCameraSwipe();

  useEffect(() => {
    return initOfflineEngine(setIsOnline);
  }, []);

  // hide top bar & dock when inside an open chat thread
  const inThread = /^\/messages\/[^/]+/.test(pathname);
  const chrome = !inThread;
  // Pages that manage their own viewport height (no extra main padding/max-width)
  const fullBleed = inThread || pathname === "/messages";
  // Wide desktops get a secondary contextual column on feed-style routes.
  const showRail = !fullBleed && ["/", "/news", "/challenges", "/comics"].includes(pathname);

  // Top-level tab order for swipe navigation
  const tabOrder = ["/", "/news", "/stories/new", "/messages", "/profile"];
  const currentIdx = tabOrder.findIndex((t) =>
    t === "/" ? pathname === "/" : pathname.startsWith(t),
  );

  useEffect(() => {
    if (!user) return;
    // Proactive standard browser push notification permission prompt
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const askKey = `flick:push-prompted:${user.id}`;
      if (!localStorage.getItem(askKey)) {
        window.setTimeout(async () => {
          localStorage.setItem(askKey, "1");
          await requestDesktopNotificationPermission();
        }, 3500);
      }
    }

    // Initialize full realtime notification engine (DMs, notch, chimes, OS background pushes)
    const cleanupRealtimePush = initRealtimePushEngine({
      userId: user.id,
      navigate,
      getCurrentPath: () => window.location.pathname,
    });

    // Native & OneSignal push binding
    void initWebPush().then(async (ready) => {
      if (ready) await linkWebPushUser(user.id);
    });
    void initOneSignal().then(() => loginPushUser(user.id));
    void setupNativeAndroidPush(user.id);

    // 4-minute Flick News notification channel
    const stopNews = startNewsNotificationChannel();
    // Best-effort last_active touch for backend targeting/inactivity logic.
    void supabase
      .from("profiles")
      .update({})
      .eq("id", user.id)
      .then(() => {
        /* noop */
      });

    // 1. Load unread notifications with local read cache filter
    const loadNotifs = async () => {
      let readCache = new Set<string>();
      try {
        readCache = new Set(JSON.parse(localStorage.getItem(`flick:read_notifs_${user.id}`) ?? "[]"));
      } catch {}
      const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .is("read_at", null);
      const remainingUnread = (data ?? []).filter((n: { id: string }) => !readCache.has(n.id)).length;
      setUnread(remainingUnread);
      setGlobalBadge(remainingUnread);
    };

    // 2. Load unread DMs
    const loadDMs = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("messages")
        .select("id")
        .eq("recipient_id", user.id)
        .is("read_at", null)
        .or(`expires_at.is.null,expires_at.gt.${now}`);
      const count = data?.length ?? 0;
      setUnreadDMs(count);
      if (typeof window !== "undefined" && (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } }).electronAPI?.setBadgeCount) {
        (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } }).electronAPI?.setBadgeCount?.(count);
      }
    };

    loadNotifs();
    loadDMs();

    window.addEventListener("flick:notifications-updated", loadNotifs);
    const onDmUnreadEvent = (e: Event) => {
      const custom = e as CustomEvent<{ total?: number; increment?: number }>;
      if (typeof custom.detail?.total === "number") {
        setUnreadDMs(custom.detail.total);
        if (typeof window !== "undefined" && (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } }).electronAPI?.setBadgeCount) {
          (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } }).electronAPI?.setBadgeCount?.(custom.detail.total);
        }
      } else if (typeof custom.detail?.increment === "number") {
        setUnreadDMs((prev) => {
          const next = Math.max(0, prev + custom.detail.increment!);
          if (typeof window !== "undefined" && (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } }).electronAPI?.setBadgeCount) {
            (window as unknown as { electronAPI?: { setBadgeCount?: (n: number) => void } }).electronAPI?.setBadgeCount?.(next);
          }
          return next;
        });
        void loadDMs();
      } else {
        void loadDMs();
      }
    };
    window.addEventListener("flick:dm-unread-updated", onDmUnreadEvent);
    window.addEventListener("focus", loadDMs);

    const dmInterval = setInterval(loadDMs, 3500);

    const notifCh = supabase
      .channel(`inbox-count-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        loadNotifs,
      )
      .subscribe();

    const dmCh = supabase
      .channel(`dm-count-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        loadDMs,
      )
      .subscribe();

    return () => {
      stopNews();
      cleanupRealtimePush();
      clearInterval(dmInterval);
      window.removeEventListener("flick:notifications-updated", loadNotifs);
      window.removeEventListener("flick:dm-unread-updated", onDmUnreadEvent);
      window.removeEventListener("focus", loadDMs);
      supabase.removeChannel(notifCh);
      supabase.removeChannel(dmCh);
    };
  }, [user?.id]);

  // Detach OneSignal (web + native) external id when the user signs out.
  useEffect(() => {
    if (user) return;
    setGlobalBadge(0);
    void unlinkWebPushUser();
    void logoutPushUser();
  }, [user]);

  // Route notification taps — native (Capacitor) OR web (OneSignal Web SDK / SW postMessage).
  useEffect(() => {
    const unbindNative = bindNotificationRouter(navigate);
    const onWebPushNav = (e: Event) => {
      const detail = (e as CustomEvent).detail as { url?: string; data?: Record<string, unknown> };
      // Prefer the structured payload (type + resourceId) so taps land on the
      // exact DM thread / post / story; fall back to the raw launch URL.
      const mapped = payloadToPath(detail?.data as NotifPayload | undefined);
      if (mapped) {
        navigateOnce(navigate, mapped);
        return;
      }
      const url = detail?.url;
      if (url) {
        try {
          const u = new URL(url, location.origin);
          if (u.origin === location.origin) navigateOnce(navigate, u.pathname + u.search + u.hash);
          else window.open(u.toString(), "_blank");
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener("flick:push-navigate", onWebPushNav);
    return () => {
      unbindNative();
      window.removeEventListener("flick:push-navigate", onWebPushNav);
    };
  }, [navigate]);

  return (
    <div className="app-shell h-[100dvh] overflow-hidden flex relative bg-background">
      {/* Persistent desktop sidebar — compact ≥1024px, full ≥1280px. Never scrolls with content. */}
      <aside className="hidden lg:flex w-[88px] xl:w-[260px] shrink-0 flex-col border-r border-border p-3 xl:p-6 h-full overflow-y-auto bg-background z-30">
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/"
            className="font-display text-2xl xl:text-3xl tracking-tight text-center xl:text-left"
          >
            f<span className="hidden xl:inline">lick</span>
            <span className="text-snap">.</span>
          </Link>
        </div>

        {/* Multitenant Workspace Selector Pill */}
        <button
          type="button"
          onClick={() => setWorkspaceModalOpen(true)}
          className="mb-6 w-full flex items-center justify-between gap-2 p-2 rounded-2xl bg-secondary/80 hover:bg-secondary border border-border transition text-left group"
          title="Switch Workspace / Tenant"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border shadow-inner"
              style={{
                borderColor: `${currentTenant.accent_color}50`,
                backgroundColor: `${currentTenant.accent_color}25`,
                color: currentTenant.accent_color,
              }}
            >
              {currentTenant.name.charAt(0)}
            </div>
            <div className="hidden xl:block min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground truncate leading-tight">
                {currentTenant.name}
              </div>
              <div className="text-[10px] text-muted-foreground truncate font-mono">
                #{currentTenant.slug}
              </div>
            </div>
          </div>
          <ChevronDown className="hidden xl:block w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition shrink-0" />
        </button>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            return (
              <Link
                key={t.to}
                to={t.to}
                title={t.label}
                className={`flex items-center justify-center xl:justify-start gap-4 px-3 xl:px-4 py-3 rounded-full text-lg transition relative ${
                  active ? "bg-secondary font-semibold" : "hover:bg-secondary/60"
                }`}
              >
                <t.icon className="w-6 h-6 shrink-0" />
                <span className="hidden xl:inline">{t.label}</span>
                {t.to === "/messages" && unreadDMs > 0 && (
                  <span className="absolute top-1.5 right-2 xl:static xl:ml-auto bg-snap text-snap-foreground text-[10px] xl:text-xs font-bold rounded-full px-1.5 xl:px-2 py-0.5 shadow-sm">
                    {unreadDMs.toLocaleString()}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            to="/comics"
            title="Comics"
            className="flex items-center justify-center xl:justify-start gap-4 px-3 xl:px-4 py-3 rounded-full text-lg transition hover:bg-secondary/60"
          >
            <BookOpen className="w-6 h-6 shrink-0" />
            <span className="hidden xl:inline">Comics</span>
          </Link>
          <Link
            to="/camera"
            title="Camera"
            className="flex items-center justify-center xl:justify-start gap-4 px-3 xl:px-4 py-3 rounded-full text-lg transition hover:bg-secondary/60"
          >
            <Plus className="w-6 h-6 shrink-0" />
            <span className="hidden xl:inline">Camera</span>
          </Link>
          <button
            onClick={() => setInboxOpen(true)}
            title="Notifications"
            className="flex items-center justify-center xl:justify-start gap-4 px-3 xl:px-4 py-3 rounded-full text-lg transition hover:bg-secondary/60 text-left relative"
          >
            <Bell className="w-6 h-6 shrink-0" />
            <span className="hidden xl:inline">Notifications</span>
            {unread > 0 && (
              <span className="absolute top-1.5 right-2 xl:static xl:ml-auto bg-snap text-snap-foreground text-[10px] xl:text-xs font-bold rounded-full px-1.5 xl:px-2 py-0.5">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </nav>
        <div className="mt-auto flex items-center justify-center xl:justify-start gap-3 p-2 xl:p-3 rounded-2xl xl:border border-border">
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={40} />
          <div className="hidden xl:block flex-1 min-w-0">
            <div className="font-semibold truncate text-sm">{profile?.display_name}</div>
            <div className="text-xs text-muted-foreground truncate">@{profile?.handle}</div>
          </div>
          <button
            onClick={signOut}
            className="hidden xl:block text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main viewport — the only vertical scroll container */}
      <main
        ref={viewportRef}
        data-app-viewport
        className={`flex-1 min-w-0 min-h-0 bg-background relative z-10 overflow-x-hidden no-scrollbar ${
          fullBleed ? "overflow-y-hidden h-full" : "overflow-y-auto"
        }`}
      >
        {/* Offline Audio & Visual Alert Banner */}
        {!isOnline && (
          <div className="sticky top-0 z-40 bg-amber-500/20 backdrop-blur-xl border-b border-amber-500/40 text-amber-200 text-xs py-2 px-4 flex items-center justify-center gap-2 font-bold shadow-md">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>U no get internet again ooo! Browsing cached Flicks & Stories</span>
          </div>
        )}

        {/* Mobile/tablet top bar — bell & font studio */}
        {chrome && (
          <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-background/85 backdrop-blur border-b border-border">
            <div className="flex items-center gap-2">
              <Link to="/" className="font-display text-xl tracking-tight">
                flick<span className="text-snap">.</span>
              </Link>
              <button
                type="button"
                onClick={() => setWorkspaceModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border/80 text-xs font-semibold text-foreground/90 max-w-[140px]"
                title="Switch Workspace"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: currentTenant.accent_color }}
                />
                <span className="truncate text-[11px] font-bold">{currentTenant.name}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInboxOpen(true)}
                className="relative w-9 h-9 rounded-full bg-secondary grid place-items-center"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-snap text-snap-foreground text-[10px] font-bold grid place-items-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full overflow-x-hidden ${
              fullBleed
                ? "h-full"
                : `mx-auto max-w-[640px] lg:max-w-none lg:px-8 xl:px-10 ${chrome ? "pb-28 lg:pb-10" : ""}`
            }`}
            drag={chrome && currentIdx >= 0 ? "x" : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.22}
            onDragEnd={(_, info) => {
              const dx = info.offset.x,
                vx = info.velocity.x;
              if (currentIdx < 0) return;
              if ((dx > 80 || vx > 400) && currentIdx > 0) {
                void triggerLightHaptic();
                navigate(tabOrder[currentIdx - 1]);
              } else if ((dx < -80 || vx < -400) && currentIdx < tabOrder.length - 1) {
                void triggerLightHaptic();
                navigate(tabOrder[currentIdx + 1]);
              }
            }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Optional right rail — only when there is genuine horizontal room */}
      {showRail && (
        <Suspense
          fallback={<aside className="hidden xl:block w-[320px] shrink-0 border-l border-border" />}
        >
          <RightRail />
        </Suspense>
      )}

      {/* Mobile/tablet floating dock */}
      {chrome && (
        <nav className="lg:hidden fixed bottom-4 inset-x-3 z-40 pointer-events-none">
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto mx-auto max-w-md card-glass rounded-[28px] px-2 py-1.5 grid grid-cols-6 items-center shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]"
            style={{
              background: "linear-gradient(160deg, rgba(20,22,28,0.92), rgba(8,9,12,0.88))",
            }}
          >
            {tabs.map((t) => {
              const active =
                pathname === t.to ||
                (t.to === "/stories/new" && pathname.startsWith("/stories")) ||
                (t.to !== "/" && t.to !== "/stories/new" && pathname.startsWith(t.to));
              if (t.center) {
                return (
                  <Link key={t.to} to={t.to} className="flex flex-col items-center -mt-7 relative">
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className="w-14 h-14 rounded-full grid place-items-center shadow-[0_0_30px_rgba(180,255,80,0.5)]"
                      style={{
                        background:
                          "radial-gradient(circle at 30% 30%, oklch(0.95 0.18 130), oklch(0.7 0.22 150))",
                      }}
                    >
                      <t.icon className="w-6 h-6 text-snap-foreground" />
                    </motion.div>
                    <span className="text-[9px] uppercase tracking-wider mt-1 text-foreground/80">
                      {t.label}
                    </span>
                  </Link>
                );
              }
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  data-coach={
                    t.to === "/messages"
                      ? "coach-dm"
                      : t.to === "/profile"
                        ? "coach-profile"
                        : undefined
                  }
                  className={`relative flex flex-col items-center gap-1 py-2.5 transition ${active ? "text-foreground" : "text-muted-foreground/70"}`}
                >
                  <motion.div whileTap={{ scale: 0.85 }} className="relative">
                    <t.icon
                      className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_rgba(180,255,80,0.7)]" : ""}`}
                    />
                    {t.to === "/messages" && unreadDMs > 0 && (
                      <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-snap text-snap-foreground text-[9px] font-bold grid place-items-center shadow-sm">
                        {unreadDMs.toLocaleString()}
                      </span>
                    )}
                  </motion.div>
                  <span className="text-[9px] uppercase tracking-wider">{t.label}</span>
                  {active && (
                    <motion.span
                      layoutId="navdot"
                      className="absolute -bottom-0.5 w-6 h-1 rounded-full bg-snap"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="relative flex flex-col items-center gap-1 py-2.5 text-muted-foreground/70"
            >
              <motion.div whileTap={{ scale: 0.85 }}>
                <MoreHorizontal className="w-5 h-5" />
              </motion.div>
              <span className="text-[9px] uppercase tracking-wider">More</span>
            </button>
          </motion.div>
        </nav>
      )}

      {/* More sheet — gives mobile access to Camera/Comics/Challenges */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
            className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-card border-t border-border rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-2"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-xl">More</h3>
                <button onClick={() => setMoreOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              {[
                { to: "/creator-insights", icon: BarChart3, label: "Creator Insights" },
                { to: "/camera", icon: Camera, label: "Camera" },
                { to: "/comics", icon: BookOpen, label: "Library" },
                { to: "/challenges", icon: Trophy, label: "Challenges" },
              ].map((m) => (
                <Link
                  key={m.to}
                  to={m.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/60"
                >
                  <span className="w-10 h-10 rounded-full bg-secondary grid place-items-center">
                    <m.icon className="w-5 h-5" />
                  </span>
                  <span className="font-semibold">{m.label}</span>
                </Link>
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  setWorkspaceModalOpen(true);
                }}
                className="w-full text-left flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/60"
              >
                <span className="w-10 h-10 rounded-full bg-secondary grid place-items-center relative">
                  <Building2 className="w-5 h-5 text-snap" />
                </span>
                <div>
                  <div className="font-semibold">Workspaces & Tenants</div>
                  <div className="text-xs text-muted-foreground">{currentTenant.name}</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  setInboxOpen(true);
                }}
                className="w-full text-left flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/60"
              >
                <span className="w-10 h-10 rounded-full bg-secondary grid place-items-center relative">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-snap text-snap-foreground text-[10px] font-bold grid place-items-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                <span className="font-semibold">Notifications</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CoachMark />
      {!fullBleed && <ScrollHint />}
      <NotificationsInbox open={inboxOpen} onClose={() => setInboxOpen(false)} />
      <WorkspaceSwitcherModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
      />
      <GlobalAudioOverlay />
    </div>
  );
}
