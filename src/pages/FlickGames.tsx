import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Gamepad2,
  Trophy,
  Flame,
  Zap,
  RotateCcw,
  Volume2,
  VolumeX,
  Share2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Send,
  Skull,
  Award,
  Crown,
  Play,
  Pause,
  ExternalLink,
  Maximize2,
  Minimize2,
  Tv,
  Wifi,
  WifiOff,
  RefreshCw,
  Compass,
  PlusCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { soundEngine } from "@/lib/soundEngine";
import { supabase } from "@/integrations/supabase/client";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import {
  fetchGameLeaderboard,
  submitGameRun,
  calculateGameScore,
  formatSeconds,
  type GamerRank,
} from "@/lib/gameLeaderboard";

const GAME_MIRRORS = [
  {
    id: "clean",
    name: "Level Devil (Clean HD Engine)",
    url: "https://classroom-6x.org/games/level2/",
    desc: "Optimized direct game engine with zero external ads & instant frame rate",
  },
  {
    id: "net",
    name: "LevelDevil.net Direct",
    url: "https://leveldevil.net/",
    desc: "Official web portal direct frame",
  },
];

export default function FlickGamesPage() {
  const { user, profile } = useAuth();
  const [activeMirror, setActiveMirror] = useState<string>("clean");
  const [tab, setTab] = useState<"game" | "leaderboard" | "secrets">("game");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"day" | "week" | "month">("day");
  const [leaderboard, setLeaderboard] = useState<GamerRank[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Screen sizing enhancement modes: "big" (default), "fit", "theatre"
  const [screenMode, setScreenMode] = useState<"big" | "fit" | "theatre">("big");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [broadcastOpen, setBroadcastOpen] = useState<boolean>(false);
  const [broadcastLevel, setBroadcastLevel] = useState<number>(15);
  const [broadcastDeaths, setBroadcastDeaths] = useState<number>(3);
  const [broadcastSeconds, setBroadcastSeconds] = useState<number>(45);
  const [broadcastNote, setBroadcastNote] = useState<string>("Survived the falling floor and runaway door! 😈");

  const gameStageRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load real dynamic leaderboard from Supabase and persistent storage
  const loadLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await fetchGameLeaderboard(leaderboardPeriod, user?.id);
      setLeaderboard(data);
    } catch (err) {
      console.error("Failed to load game leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [leaderboardPeriod, user?.id]);

  useEffect(() => {
    void loadLeaderboard();
    const handleUpdate = () => {
      void loadLeaderboard();
    };
    window.addEventListener("flick:leaderboard-updated", handleUpdate);
    return () => {
      window.removeEventListener("flick:leaderboard-updated", handleUpdate);
    };
  }, [loadLeaderboard]);

  // Monitor online / offline state for offline movement
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      toast.info("Offline mode active! Playing cached Level Devil game.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Listen to fullscreenchange
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Trigger Native Fullscreen
  const toggleNativeFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (gameStageRef.current?.requestFullscreen) {
          await gameStageRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Fall back to theatre mode if fullscreen permission blocked
      setScreenMode((m) => (m === "theatre" ? "big" : "theatre"));
    }
  };

  // Quick reload current level / game instance
  const handleReload = () => {
    void triggerLightHaptic();
    setIframeKey((k) => k + 1);
    toast.info("Game frame restarted!");
  };

  // Focus Game keyboard controls
  const handleFocusGame = () => {
    void triggerLightHaptic();
    if (iframeRef.current) {
      iframeRef.current.focus();
      try {
        iframeRef.current.contentWindow?.focus();
      } catch {}
      toast.success("Game focused! Use Arrow keys or WASD to move.");
    }
  };

  // Dispatch virtual touch keyboard events to window and iframe (for mobile gameplay)
  const sendKey = (key: string, code: string, type: "keydown" | "keyup") => {
    void triggerLightHaptic();
    const event = new KeyboardEvent(type, {
      key,
      code,
      keyCode: code === "ArrowLeft" ? 37 : code === "ArrowRight" ? 39 : 32,
      which: code === "ArrowLeft" ? 37 : code === "ArrowRight" ? 39 : 32,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    document.dispatchEvent(event);
    try {
      iframeRef.current?.contentDocument?.dispatchEvent(event);
    } catch {}
  };

  // Broadcast achievement to Flick Feed and real leaderboard ("Sent round the whole app")
  const handleBroadcast = async () => {
    if (!user) {
      toast.error("Please sign in to record and broadcast your score");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitGameRun(
        {
          level: Number(broadcastLevel) || 1,
          deaths: Number(broadcastDeaths) || 0,
          seconds: Number(broadcastSeconds) || 45,
          note: broadcastNote,
        },
        user,
        profile
      );
      void triggerSuccessHaptic();
      toast.success("Broadcasted to the entire Flick feed & leaderboard! 🚀");
      setBroadcastOpen(false);
      setTab("leaderboard");
      await loadLeaderboard();
    } catch {
      toast.error("Could not broadcast post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSource = GAME_MIRRORS.find((m) => m.id === activeMirror) || GAME_MIRRORS[0];

  return (
    <div className={`min-h-screen bg-background pb-28 ${screenMode === "theatre" ? "fixed inset-0 z-50 overflow-y-auto bg-black p-0" : "max-w-6xl mx-auto px-2 sm:px-4 pt-3 space-y-4"}`}>
      {/* Top Bar (Hidden in Theatre Mode) */}
      {screenMode !== "theatre" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-2xl text-foreground">Level Devil</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-snap text-black font-extrabold uppercase tracking-wider">
                  Official
                </span>
                {!isOnline && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />
                    <span>Offline</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The infamous troll-platformer from leveldevil.net • Enhanced big screen & offline controls
              </p>
            </div>
          </div>

          {/* Navigation Pill Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-secondary/80 rounded-2xl border border-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTab("game")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                tab === "game" ? "bg-foreground text-background shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Game</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("leaderboard")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                tab === "leaderboard" ? "bg-foreground text-background shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Top Gamers</span>
            </button>
            <button
              type="button"
              onClick={() => setBroadcastOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-snap text-black hover:brightness-105 active:scale-95 transition flex items-center gap-1 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Submit Run</span>
            </button>
          </div>
        </div>
      )}

      {/* Offline Alert Strip */}
      {!isOnline && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs px-4 py-2 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>Offline Move Active:</strong> Playing cached Level Devil. No internet required to jump & defeat trolls!
            </span>
          </div>
          <button
            type="button"
            onClick={handleReload}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 text-amber-100"
          >
            Refresh Frame
          </button>
        </div>
      )}

      {/* Main Game Tab View */}
      {tab === "game" && (
        <div className="space-y-3">
          {/* Enhanced Game Stage Container */}
          <div
            ref={gameStageRef}
            className={`relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-border/80 shadow-2xl transition-all duration-300 flex flex-col ${
              screenMode === "theatre"
                ? "h-screen w-screen rounded-none border-none"
                : screenMode === "big"
                  ? "h-[72vh] sm:h-[82vh] w-full"
                  : "aspect-[16/9] w-full max-h-[70vh]"
            }`}
          >
            {/* Top Game Utility Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/90 backdrop-blur border-b border-white/10 z-20 shrink-0 text-white text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold hidden sm:inline">{currentSource.name}</span>
                <span className="text-[11px] text-zinc-400 font-mono hidden md:inline">
                  (leveldevil.net)
                </span>
              </div>

              {/* Enhanced Sizing & Control Actions */}
              <div className="flex items-center gap-1.5">
                {/* Mirror Switcher */}
                <select
                  value={activeMirror}
                  onChange={(e) => setActiveMirror(e.target.value)}
                  className="bg-zinc-800 text-zinc-200 text-[11px] font-semibold px-2 py-1 rounded-lg border border-white/10 focus:outline-none cursor-pointer"
                  title="Switch between direct clean engine or leveldevil.net"
                >
                  {GAME_MIRRORS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {/* Focus Button */}
                <button
                  type="button"
                  onClick={handleFocusGame}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] transition flex items-center gap-1"
                  title="Focus game keys (prevent page scrolling)"
                >
                  <Compass className="w-3.5 h-3.5 text-snap" />
                  <span className="hidden sm:inline">Focus</span>
                </button>

                {/* Reload Button */}
                <button
                  type="button"
                  onClick={handleReload}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                  title="Reload / Restart Level"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                {/* Big Screen / Fit Screen Toggle */}
                <button
                  type="button"
                  onClick={() => setScreenMode((m) => (m === "big" ? "fit" : "big"))}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                    screenMode === "big"
                      ? "bg-snap text-black"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  }`}
                  title="Toggle Big Screen Size"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>{screenMode === "big" ? "Big Screen" : "Fit"}</span>
                </button>

                {/* Theatre Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setScreenMode((m) => (m === "theatre" ? "big" : "theatre"))}
                  className={`p-1.5 rounded-lg transition ${
                    screenMode === "theatre"
                      ? "bg-snap text-black"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  }`}
                  title="Theatre Mode (Max Screen)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                {/* Native Fullscreen */}
                <button
                  type="button"
                  onClick={toggleNativeFullscreen}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                  title="True Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
            </div>

            {/* Iframe Viewport: Exact leveldevil.net engine */}
            <div className="flex-1 w-full relative bg-black flex items-center justify-center overflow-hidden">
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={currentSource.url}
                title="Level Devil Game"
                allow="autoplay; fullscreen; gamepad; focus-without-user-activation *"
                className="w-full h-full border-0 select-none bg-black"
                style={{
                  minHeight: "100%",
                  minWidth: "100%",
                }}
              />
            </div>

            {/* Mobile On-Screen Virtual Touch Controller (Only visible on touch / mobile devices) */}
            <div className="lg:hidden shrink-0 bg-gradient-to-t from-black via-zinc-950/95 to-transparent px-4 py-3 flex items-center justify-between border-t border-white/10 z-20">
              {/* D-Pad: Left & Right */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onPointerDown={() => sendKey("ArrowLeft", "ArrowLeft", "keydown")}
                  onPointerUp={() => sendKey("ArrowLeft", "ArrowLeft", "keyup")}
                  onPointerLeave={() => sendKey("ArrowLeft", "ArrowLeft", "keyup")}
                  className="w-14 h-14 rounded-2xl bg-zinc-800 active:bg-zinc-700 active:scale-90 text-white font-bold grid place-items-center shadow-lg border border-white/20 select-none touch-none"
                  aria-label="Move Left"
                >
                  <ArrowLeft className="w-7 h-7" />
                </button>

                <button
                  type="button"
                  onPointerDown={() => sendKey("ArrowRight", "ArrowRight", "keydown")}
                  onPointerUp={() => sendKey("ArrowRight", "ArrowRight", "keyup")}
                  onPointerLeave={() => sendKey("ArrowRight", "ArrowRight", "keyup")}
                  className="w-14 h-14 rounded-2xl bg-zinc-800 active:bg-zinc-700 active:scale-90 text-white font-bold grid place-items-center shadow-lg border border-white/20 select-none touch-none"
                  aria-label="Move Right"
                >
                  <ArrowRight className="w-7 h-7" />
                </button>
              </div>

              {/* Big Jump Pad */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={() => sendKey(" ", "Space", "keydown")}
                  onPointerUp={() => sendKey(" ", "Space", "keyup")}
                  onPointerLeave={() => sendKey(" ", "Space", "keyup")}
                  className="h-14 px-8 rounded-2xl bg-snap active:bg-lime-400 active:scale-90 text-black font-extrabold flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(180,255,80,0.4)] select-none touch-none"
                  aria-label="Jump"
                >
                  <Zap className="w-6 h-6 fill-current" />
                  <span className="text-sm tracking-wider uppercase">JUMP</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Troll Tips & Keyboard Mapping Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-card border border-border flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-snap/15 text-snap grid place-items-center font-bold text-sm shrink-0">
                ⌨️
              </span>
              <div>
                <h4 className="font-bold text-xs text-foreground">Keyboard Controls</h4>
                <p className="text-[11px] text-muted-foreground">
                  Use <strong>Arrow Keys</strong> or <strong>W, A, D</strong>. Press <strong>Space</strong> or <strong>Up</strong> to Jump. Tap <em>Focus</em> to lock keys.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-card border border-border flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 grid place-items-center font-bold text-sm shrink-0">
                😈
              </span>
              <div>
                <h4 className="font-bold text-xs text-foreground">Troll Mechanics</h4>
                <p className="text-[11px] text-muted-foreground">
                  Doors runaway, spikes pop up without warning, and floors collapse. Don't rush; pause before the goal!
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-card border border-border flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 grid place-items-center font-bold text-sm shrink-0">
                👑
              </span>
              <div>
                <h4 className="font-bold text-xs text-foreground">Algorithm Rankings</h4>
                <p className="text-[11px] text-muted-foreground">
                  Clearing levels with minimal deaths vaults you to <strong>Top Gamer of the Day</strong> on the feed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboards Tab */}
      {tab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="font-display font-extrabold text-xl text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Level Devil Algorithm Leaderboard</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Ranked by levels cleared, survival time, and lowest troll deaths
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setBroadcastOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-snap text-black hover:brightness-105 active:scale-95 transition flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Submit My Run</span>
              </button>

              <button
                type="button"
                onClick={loadLeaderboard}
                disabled={loadingLeaderboard}
                title="Refresh rankings"
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-muted-foreground hover:text-foreground transition active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaderboard ? "animate-spin text-snap" : ""}`} />
              </button>

              {/* Time Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-secondary rounded-2xl border border-border">
                {(["day", "week", "month"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setLeaderboardPeriod(period)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                      leaderboardPeriod === period
                        ? "bg-foreground text-background shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {period === "day" ? "Day 👑" : period === "week" ? "Week ⚡" : "Month 🏆"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loadingLeaderboard && (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 rounded-3xl bg-secondary/50 border border-border" />
                ))}
              </div>
              <div className="h-44 rounded-3xl bg-secondary/40 border border-border" />
            </div>
          )}

          {/* Empty State */}
          {!loadingLeaderboard && leaderboard.length === 0 && (
            <div className="text-center py-12 px-4 rounded-3xl bg-card border border-border space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 grid place-items-center text-2xl">
                👑
              </div>
              <h3 className="font-bold text-base text-foreground">No runs logged yet for this period!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Be the first to claim Top Gamer of the {leaderboardPeriod === "day" ? "Day" : leaderboardPeriod === "week" ? "Week" : "Month"}. Play Level Devil and log your run.
              </p>
              <button
                type="button"
                onClick={() => setBroadcastOpen(true)}
                className="px-4 py-2 rounded-2xl text-xs font-extrabold bg-snap text-black hover:brightness-105 active:scale-95 transition inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Submit Run Now</span>
              </button>
            </div>
          )}

          {/* Content When Loaded */}
          {!loadingLeaderboard && leaderboard.length > 0 && (
            <>
              {/* Top 3 Podium Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {leaderboard.slice(0, 3).map((gamer, idx) => {
                  const bg =
                    idx === 0
                      ? "bg-gradient-to-b from-amber-500/20 via-card to-card border-amber-500/40"
                      : idx === 1
                        ? "bg-gradient-to-b from-slate-400/20 via-card to-card border-slate-400/30"
                        : "bg-gradient-to-b from-amber-700/20 via-card to-card border-amber-700/30";

                  return (
                    <div
                      key={gamer.id || gamer.handle}
                      className={`p-5 rounded-3xl border shadow-lg relative overflow-hidden flex flex-col items-center text-center ${bg} ${
                        gamer.isCurrentUser ? "ring-2 ring-snap" : ""
                      }`}
                    >
                      <div className="absolute top-3 right-3 text-2xl">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                      </div>
                      {gamer.isCurrentUser && (
                        <div className="absolute top-3 left-3 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-snap text-black uppercase tracking-wider">
                          You
                        </div>
                      )}
                      <Avatar url={gamer.avatar} name={gamer.name} size={64} className="ring-4 ring-background mb-3 shadow-md" />
                      <h3 className="font-bold text-base text-foreground truncate max-w-[180px]">{gamer.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{gamer.handle}</p>
                      
                      <div className="mt-2 text-xs font-extrabold text-snap bg-snap/10 px-3 py-1 rounded-full border border-snap/30">
                        {gamer.badge}
                      </div>

                      <div className="mt-2 text-[11px] font-bold text-foreground font-mono">
                        {gamer.score.toLocaleString()} pts
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-1.5 w-full pt-3 border-t border-border/80 text-xs font-mono">
                        <div className="bg-secondary/50 p-2 rounded-xl">
                          <span className="text-muted-foreground text-[10px] block">Level</span>
                          <strong className="text-foreground text-sm">{gamer.level}</strong>
                        </div>
                        <div className="bg-secondary/50 p-2 rounded-xl">
                          <span className="text-muted-foreground text-[10px] block">Deaths</span>
                          <strong className="text-rose-400 text-sm">{gamer.deaths}</strong>
                        </div>
                        <div className="bg-secondary/50 p-2 rounded-xl">
                          <span className="text-muted-foreground text-[10px] block">Time</span>
                          <strong className="text-foreground text-xs">{gamer.time}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leaderboard Table */}
              <div className="rounded-3xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-secondary/40 text-xs font-bold text-muted-foreground grid grid-cols-12">
                  <span className="col-span-1">#</span>
                  <span className="col-span-5">Player</span>
                  <span className="col-span-2 text-center">Score</span>
                  <span className="col-span-2 text-center">Level / Deaths</span>
                  <span className="col-span-2 text-right">Time</span>
                </div>
                <div className="divide-y divide-border">
                  {leaderboard.map((g) => (
                    <div
                      key={g.id || g.handle}
                      className={`px-5 py-3.5 flex items-center grid grid-cols-12 text-sm transition ${
                        g.isCurrentUser ? "bg-snap/10 border-l-4 border-l-snap" : "hover:bg-secondary/30"
                      }`}
                    >
                      <span className="col-span-1 font-mono font-bold text-muted-foreground">
                        #{g.rank}
                      </span>
                      <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                        <Avatar url={g.avatar} name={g.name} size={32} />
                        <div className="min-w-0">
                          <div className="font-bold truncate text-foreground flex items-center gap-1.5">
                            <span>{g.name}</span>
                            {g.isCurrentUser && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-snap text-black font-extrabold uppercase">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {g.handle}
                          </div>
                        </div>
                      </div>
                      <span className="col-span-2 text-center font-bold text-foreground font-mono">
                        {g.score.toLocaleString()}
                      </span>
                      <div className="col-span-2 text-center font-mono text-xs">
                        <span className="font-bold text-snap">Lvl {g.level}</span>
                        <span className="text-muted-foreground mx-1">•</span>
                        <span className="text-rose-400">{g.deaths}💀</span>
                      </div>
                      <span className="col-span-2 text-right font-mono text-xs text-muted-foreground">
                        {g.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Broadcast Score Modal */}
      <AnimatePresence>
        {broadcastOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setBroadcastOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-10 h-10 rounded-2xl bg-snap/20 text-snap grid place-items-center">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Log & Broadcast Run</h3>
                    <p className="text-xs text-muted-foreground">Updates your rank & posts to community feed</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Score Estimation */}
              <div className="p-3.5 rounded-2xl bg-snap/10 border border-snap/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Calculated Algorithmic Score
                  </span>
                  <strong className="text-xl font-black text-snap font-mono">
                    {calculateGameScore(broadcastLevel, broadcastDeaths, broadcastSeconds).toLocaleString()} pts
                  </strong>
                </div>
                <div className="text-right text-xs font-mono text-muted-foreground">
                  <div>Lvl {broadcastLevel}</div>
                  <div>{formatSeconds(broadcastSeconds)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      Level Reached
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={80}
                      value={broadcastLevel}
                      onChange={(e) => setBroadcastLevel(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-2xl bg-secondary border border-border text-sm font-mono text-foreground focus:outline-none focus:border-snap"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      Troll Deaths
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={broadcastDeaths}
                      onChange={(e) => setBroadcastDeaths(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-2xl bg-secondary border border-border text-sm font-mono text-foreground focus:outline-none focus:border-snap"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      Time (Seconds)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={broadcastSeconds}
                      onChange={(e) => setBroadcastSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-2xl bg-secondary border border-border text-sm font-mono text-foreground focus:outline-none focus:border-snap"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">
                    Run Note / Troll Reaction
                  </label>
                  <textarea
                    value={broadcastNote}
                    onChange={(e) => setBroadcastNote(e.target.value)}
                    rows={3}
                    placeholder="Tell everyone how you survived the troll traps…"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-snap resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBroadcastOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBroadcast}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-snap text-black hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 shadow-md shadow-snap/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmitting ? "Publishing…" : "Broadcast & Record"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
