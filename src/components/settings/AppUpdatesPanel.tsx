import { useState, useEffect } from "react";
import {
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Globe,
  Monitor,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { checkForAppUpdates, applyInAppUpdate, type AppUpdateInfo } from "@/lib/appUpdater";
import { fireSparkleConfetti } from "@/lib/confetti";
import { toast } from "sonner";

export function AppUpdatesPanel() {
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo>({
    currentVersion: "2.2.0",
    latestVersion: "2.2.0",
    hasUpdate: false,
    source: "Cloud Release Network",
    checkedAt: Date.now(),
    changelog: [
      "In-App Hot Updates: Stream direct delta updates without downloading bulky installers",
      "Offline Auth Resilience: Never signed out on exit, tab close, or offline restarts",
      "Clean Notification Center: Streamlined preferences with zero clutter",
      "Large floating in-app push banners for instant incoming direct messages",
    ],
  });

  const [autoCheck, setAutoCheck] = useState(() => {
    return localStorage.getItem("flick:auto_update_check") !== "false";
  });
  const [simulatedUpdate, setSimulatedUpdate] = useState(false);

  const isElectron =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);

  const handleCheck = async (showToast = true) => {
    setChecking(true);
    try {
      const info = await checkForAppUpdates();
      setUpdateInfo(info);
      if (showToast) {
        if (info.hasUpdate || simulatedUpdate) {
          toast.success(`Update available: v${info.latestVersion || "2.2.1"}`);
        } else {
          toast.success("Flick is up to date (v2.2.0)");
        }
      }
    } catch {
      if (showToast) toast.error("Could not reach update server. Using local offline version.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Initial check on panel open
    void handleCheck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyUpdate = async () => {
    setApplying(true);
    fireSparkleConfetti();
    toast.info("Updating Flick to latest version…");

    try {
      const success = await applyInAppUpdate();
      if (!success) {
        // Fallback reload
        window.location.reload();
      }
    } catch {
      window.location.reload();
    } finally {
      setApplying(false);
    }
  };

  const toggleSimulateUpdate = () => {
    const next = !simulatedUpdate;
    setSimulatedUpdate(next);
    if (next) {
      setUpdateInfo((prev) => ({
        ...prev,
        latestVersion: "2.2.1",
        hasUpdate: true,
      }));
      toast.success("Simulating update v2.2.1 available!");
    } else {
      setUpdateInfo((prev) => ({
        ...prev,
        latestVersion: prev.currentVersion,
        hasUpdate: false,
      }));
      toast.info("Cleared simulation.");
    }
  };

  const hasAnyUpdate = updateInfo.hasUpdate || simulatedUpdate;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto">
      {/* Hero Status Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card/90 via-card/50 to-primary/5 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {hasAnyUpdate ? "Update Ready to Install" : "Up to Date"}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Flick v{updateInfo.currentVersion}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {isElectron ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-primary" />
                  Desktop App &bull; Direct Hot-Reload Enabled
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  Web / PWA &bull; Cloud Synchronized
                </>
              )}
            </p>
          </div>

          <button
            onClick={() => handleCheck(true)}
            disabled={checking}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary/80 hover:bg-secondary text-xs font-semibold border border-border/80 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking…" : "Check Now"}
          </button>
        </div>

        {/* Update CTA Banner */}
        {hasAnyUpdate && (
          <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-primary/20 to-emerald-500/20 border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    New Version v{updateInfo.latestVersion} Available
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Instant hot-reload stream &bull; 0MB installer download
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleApplyUpdate}
              disabled={applying}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
            >
              <DownloadCloud className={`w-4 h-4 ${applying ? "animate-bounce" : ""}`} />
              {applying ? "Applying Hot Update…" : "Apply Hot Update Now (1 Sec)"}
            </button>
          </div>
        )}
      </div>

      {/* No installer explanation */}
      <div className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-3">
        <div className="flex items-center gap-2.5 text-xs font-bold text-foreground">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Zero Reinstall Overhead</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Instead of downloading and installing heavy executable packages every time you update Flick,
          the app dynamically applies the newest release over the air. All your local offline messages,
          credentials, and settings remain untouched.
        </p>
      </div>

      {/* Preferences & Toggles */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Update Settings
        </h3>

        <label className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card/40 hover:bg-card/70 transition cursor-pointer">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold">Automatic Update Checks</div>
            <div className="text-xs text-muted-foreground">
              Search for new releases automatically on launch
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoCheck}
            onChange={(e) => {
              setAutoCheck(e.target.checked);
              localStorage.setItem("flick:auto_update_check", String(e.target.checked));
            }}
            className="w-5 h-5 accent-primary cursor-pointer"
          />
        </label>

        <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card/40">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Offline Auth & Data Protection
            </div>
            <div className="text-xs text-muted-foreground">
              Sessions and offline caches persist across hot updates
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            Always Active
          </span>
        </div>
      </div>

      {/* Recent Improvements Changelog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What's New in v2.2.0
          </h3>
          <span className="text-[11px] text-muted-foreground">Stable release</span>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-2.5">
          {(updateInfo.changelog || []).map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Testing & Developer Tools */}
      <div className="pt-2 border-t border-border/50">
        <button
          onClick={toggleSimulateUpdate}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-border hover:bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <Info className="w-3.5 h-3.5" />
          {simulatedUpdate ? "Disable Simulated Update Test" : "Simulate 'New Update Ready' UI"}
        </button>
      </div>
    </div>
  );
}
