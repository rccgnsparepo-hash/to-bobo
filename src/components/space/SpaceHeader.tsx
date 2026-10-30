import { Radio, Users, Phone, GraduationCap, BookOpen, Mic, Calendar, Compass, ArrowLeft, Plus } from "lucide-react";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useNavigate } from "react-router-dom";
import type { SpaceTab } from "@/lib/space/types";

interface Props {
  activeTab: SpaceTab;
  onTabChange: (tab: SpaceTab) => void;
  onStartGoLive: () => void;
  activeLiveCount: number;
  activeRoomsCount: number;
}

export function SpaceHeader({
  activeTab,
  onTabChange,
  onStartGoLive,
  activeLiveCount,
  activeRoomsCount,
}: Props) {
  const navigate = useNavigate();

  const tabs: { id: SpaceTab; label: string; icon: typeof Radio; badge?: number; livePulse?: boolean }[] = [
    { id: "live", label: "Live", icon: Radio, badge: activeLiveCount, livePulse: activeLiveCount > 0 },
    { id: "rooms", label: "Rooms", icon: Users, badge: activeRoomsCount },
    { id: "calls", label: "Calls", icon: Phone },
    { id: "classes", label: "Classes", icon: GraduationCap },
    { id: "prep", label: "Prep Class", icon: BookOpen },
    { id: "recordings", label: "Recordings", icon: Mic },
    { id: "schedule", label: "My Schedule", icon: Calendar },
    { id: "discover", label: "Discover", icon: Compass },
  ];

  return (
    <header className="relative z-30 w-full px-4 pt-3 pb-2.5 border-b border-border bg-background/90 backdrop-blur-xl shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Back & Branding */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 grid place-items-center text-foreground transition active:scale-95"
            title="Return to Feed"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-base sm:text-lg tracking-tight leading-none text-foreground flex items-center gap-1">
                <span>flick space</span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              </h1>
              <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold border border-rose-500/20">
                REAL-TIME
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              Live broadcast, audio rooms, virtual classes & recordings
            </p>
          </div>
        </div>

        {/* Center: Scrollable Segmented Bar */}
        <nav className="flex items-center gap-1 p-1 rounded-full bg-secondary/80 border border-border overflow-x-auto no-scrollbar max-w-xl">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  onTabChange(tab.id);
                }}
                className={`relative px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  active
                    ? "bg-background text-foreground shadow-sm font-bold border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    tab.id === "live"
                      ? "text-rose-500"
                      : tab.id === "rooms"
                      ? "text-amber-500"
                      : tab.id === "classes"
                      ? "text-blue-500"
                      : ""
                  }`}
                />
                <span>{tab.label}</span>
                {tab.livePulse && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                )}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-500 font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Go Live Launcher Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void triggerMediumHaptic();
              onStartGoLive();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-500/25 hover:opacity-95 active:scale-95 transition"
            title="Start Live Broadcast"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Go Live</span>
          </button>
        </div>
      </div>
    </header>
  );
}
