import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  Archive,
  Activity,
  Bell,
  Clock,
  Tablet,
  BarChart3,
  BadgeCheck,
  Settings,
  Lock,
  Star,
  Slash,
  EyeOff,
  MessageSquare,
  LogOut,
  ChevronRight,
  Shield,
  HardDrive,
  RefreshCw,
  Film,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePremium } from "@/lib/premium";
import { UpgradeModal } from "./UpgradeModal";
import { PushStatusCard } from "./PushStatusCard";
import { SettingsDetail, type SettingsPanel } from "./settings/SettingsDetail";
import { useAppPrefs } from "@/lib/appPrefs";

type Item = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
  danger?: boolean;
  onClick: () => void;
};

export function ProfileSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isPremium } = usePremium();
  const { prefs } = useAppPrefs();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [panel, setPanel] = useState<SettingsPanel | null>(null);
  const [search, setSearch] = useState("");

  const sections: { title: string; items: Item[] }[] = [
    {
      title: "How you use Flick",
      items: [
        { icon: RefreshCw, label: "App Updates & Hot Reload", sub: "Instant over-the-air updates & reload", onClick: () => setPanel("updates") },
        { icon: Film, label: "Replay Intro Animation", sub: "Watch the cinematic launch intro", onClick: () => { onClose(); navigate("/intro"); } },
        { icon: Bookmark, label: "Saved", sub: "View collection", onClick: () => setPanel("saved") },
        { icon: Archive, label: "Archive", sub: String(prefs.archivedPosts?.length ?? 0), onClick: () => setPanel("archive") },
        { icon: Activity, label: "Your activity", onClick: () => setPanel("activity") },
        { icon: Bell, label: "Notifications", sub: "Push & in-app alerts", onClick: () => setPanel("notifications") },
        { icon: Clock, label: "Time management", sub: prefs.dailyLimitMin ? `${prefs.dailyLimitMin}m limit` : "Track stats", onClick: () => setPanel("time") },
        { icon: HardDrive, label: "Media & storage", sub: "Auto-download & cache", onClick: () => setPanel("mediaStorage") },
        { icon: Tablet, label: "Flick for tablets & PC", sub: "Layout & shortcuts", onClick: () => setPanel("tablet") },
      ],
    },
    {
      title: "For creators",
      items: [
        {
          icon: BarChart3,
          label: "Creator Insights",
          sub: "Views, trends & activity heatmap",
          onClick: () => {
            onClose();
            navigate("/creator-insights");
          },
        },
        {
          icon: BadgeCheck,
          label: "Flick Verified",
          sub: isPremium ? "Active ✦" : "Apply & Status",
          onClick: () => {
            onClose();
            navigate("/verification");
          },
        },
        { icon: Settings, label: "Account tools", onClick: () => setPanel("tools") },
      ],
    },
    {
      title: "Who can see your content",
      items: [
        { icon: Lock, label: "Account privacy", sub: prefs.privateAccount ? "Private" : "Public", onClick: () => setPanel("privacy") },
        { icon: Star, label: "Close Friends", sub: String(prefs.closeFriends?.length ?? 0), onClick: () => setPanel("closeFriends") },
        { icon: EyeOff, label: "Hide story", sub: `${prefs.hiddenStoryUsers?.length ?? 0} hidden`, onClick: () => setPanel("hideStory") },
        { icon: Slash, label: "Blocked", sub: "Manage blocks", onClick: () => setPanel("blocked") },
      ],
    },
    {
      title: "How others interact with you",
      items: [
        { icon: MessageSquare, label: "Messages and story replies", sub: prefs.dmFrom === "everyone" ? "Everyone" : "Restricted", onClick: () => setPanel("messages") },
        { icon: Shield, label: "Tags and mentions", onClick: () => setPanel("privacy") },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: LogOut, label: "Sign out", danger: true, onClick: signOut },
      ],
    },
  ];

  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => it.label.toLowerCase().includes(search.toLowerCase())),
    }))
    .filter((sec) => sec.items.length > 0);

  if (!open) return null;

  return createPortal(
    <>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      <SettingsDetail panel={panel} onClose={() => setPanel(null)} />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-md flex items-center justify-center p-0 md:p-6 select-none"
        >
          {/* Centered responsive modal container for laptop, tablet, & desktop */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full md:max-w-xl md:h-[88vh] md:max-h-[850px] bg-background md:rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3.5 flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-secondary transition text-muted-foreground hover:text-foreground"
                aria-label="Close settings"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="font-display text-lg tracking-tight flex-1">Settings and activity</h1>
            </header>

            {/* Search */}
            <div className="px-4 py-3 border-b border-border bg-card/20">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search settings..."
                className="w-full bg-secondary/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-snap transition"
              />
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto pb-10">
              <div className="p-3">
                <PushStatusCard />
              </div>

              {filteredSections.map((sec) => (
                <div key={sec.title} className="mb-3">
                  <div className="px-4 pt-3 pb-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {sec.title}
                  </div>
                  <ul className="bg-card/40 border-y border-border divide-y divide-border/50">
                    {sec.items.map((it) => (
                      <li key={it.label}>
                        <button
                          type="button"
                          onClick={it.onClick}
                          className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-secondary/40 active:bg-secondary/60 transition text-left group ${
                            it.danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"
                          }`}
                        >
                          <it.icon
                            className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                              it.danger ? "text-destructive" : "text-snap"
                            }`}
                          />
                          <span className="flex-1 text-sm font-medium">{it.label}</span>
                          {it.sub && (
                            <span className="text-xs text-muted-foreground mr-1 font-mono">
                              {it.sub}
                            </span>
                          )}
                          {!it.danger && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>,
    document.body
  );
}