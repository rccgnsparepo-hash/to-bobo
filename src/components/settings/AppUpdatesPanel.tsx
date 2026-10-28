import { useState } from "react";
import {
  DownloadCloud,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { playSound } from "@/lib/soundEngine";
import { fireSparkleConfetti } from "@/lib/confetti";

export function AppUpdatesPanel() {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentVersion, setCurrentVersion] = useState("2.4.0");
  const [hasUpdate, setHasUpdate] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(() => {
    try {
      return localStorage.getItem("flick:auto_update") !== "false";
    } catch {
      return true;
    }
  });

  const handleCheck = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setHasUpdate(true);
      toast.success("Flick update v2.4.1 is available!");
    }, 1200);
  };

  const startUpdate = () => {
    if (updating) return;
    setUpdating(true);
    setProgress(1);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUpdating(false);
          setHasUpdate(false);
          setCurrentVersion("2.4.1");
          try {
            playSound("auth_success");
          } catch {}
          fireSparkleConfetti();
          toast.success("Flick has been successfully updated!");
          return 100;
        }
        return prev + 2;
      });
    }, 45);
  };

  return (
    <div className="p-4 sm:p-5 max-w-xl mx-auto space-y-5">
      {/* App Version Badge Card */}
      <div className="rounded-3xl border border-border bg-card/80 p-5 text-center relative overflow-hidden shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-snap/15 border border-snap/30 text-snap flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Sparkles className="w-8 h-8" />
        </div>

        <h3 className="font-display font-bold text-xl text-foreground">Flick</h3>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Version {currentVersion} (Build 240)
        </p>

        <div className="mt-4 flex items-center justify-center gap-2">
          {!hasUpdate && !updating ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Flick is up to date</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-snap/20 text-snap text-xs font-bold border border-snap/30">
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Update available (v2.4.1)</span>
            </span>
          )}
        </div>
      </div>

      {/* Updating Progress Counter (1 to 100) */}
      <AnimatePresence>
        {updating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-foreground">Updating Flick…</span>
              <span className="text-snap font-mono">{progress}%</span>
            </div>

            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-snap rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Applying latest improvements and security updates…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Action Button */}
      <div>
        {hasUpdate && !updating ? (
          <button
            type="button"
            onClick={startUpdate}
            className="w-full py-3.5 px-4 rounded-2xl bg-snap text-snap-foreground font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-105 transition shadow-lg shadow-snap/20"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Install Update Now</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={checking || updating}
            onClick={handleCheck}
            className="w-full py-3.5 px-4 rounded-2xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin text-snap" : ""}`} />
            <span>{checking ? "Checking for updates…" : "Check for Updates"}</span>
          </button>
        )}
      </div>

      {/* Clean Preference Switches */}
      <div className="rounded-2xl border border-border bg-card/60 divide-y divide-border/60">
        <label className="p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition">
          <div>
            <div className="text-sm font-semibold text-foreground">Automatic Updates</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Keep Flick updated in the background
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={(e) => {
              setAutoUpdate(e.target.checked);
              try {
                localStorage.setItem("flick:auto_update", String(e.target.checked));
              } catch {}
              toast(e.target.checked ? "Automatic updates turned ON" : "Automatic updates turned OFF");
            }}
            className="w-5 h-5 accent-[hsl(var(--snap))] rounded cursor-pointer"
          />
        </label>
      </div>

      {/* What's New Section */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-snap" />
          <span>What&rsquo;s New in Version {currentVersion}</span>
        </h4>

        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-snap mt-1.5 shrink-0" />
            <span>
              <strong className="text-foreground">Interactive Fashion Fitting Room:</strong> 3D avatar styling, 360° outfit rotation, and occasion pairings.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-snap mt-1.5 shrink-0" />
            <span>
              <strong className="text-foreground">Swipe-to-Delete Messages:</strong> Smooth gesture with haptic feedback to clear chat threads.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-snap mt-1.5 shrink-0" />
            <span>
              <strong className="text-foreground">Enhanced Sports & Local Wire:</strong> Fast coverage of Premier League, NPFL, and Nigerian news.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-snap mt-1.5 shrink-0" />
            <span>
              <strong className="text-foreground">Daily Post Limits:</strong> Visual countdown keeping track of daily flicks.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
