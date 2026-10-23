import { useState, useEffect } from "react";
import {
  Wifi,
  Smartphone,
  Globe2,
  HardDrive,
  Trash2,
  Check,
  Info,
  Clock,
  Layers,
  Server,
  Volume2,
  Zap,
} from "lucide-react";
import {
  getMediaStoragePrefs,
  saveMediaStoragePrefs,
  getCurrentConnectionType,
  estimateCachedMediaStorage,
  clearMediaCache,
  type DownloadPolicy,
  type CacheRetention,
  type MediaStoragePrefs,
} from "@/lib/mediaStorage";
import { playOfflineVoiceAlert } from "@/lib/offlineManager";
import { toast } from "sonner";

export function MediaStoragePanel() {
  const [prefs, setPrefs] = useState<MediaStoragePrefs>(() => getMediaStoragePrefs());
  const [netInfo, setNetInfo] = useState(() => getCurrentConnectionType());
  const [storageEstimate, setStorageEstimate] = useState<{
    formatted: string;
    imageBytes: number;
    videoBytes: number;
    audioBytes: number;
  }>({
    formatted: "Calculating…",
    imageBytes: 0,
    videoBytes: 0,
    audioBytes: 0,
  });
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    estimateCachedMediaStorage().then((est) => {
      setStorageEstimate(est);
    });
  }, []);

  const updatePolicy = (key: "wifi" | "cellular" | "roaming", val: DownloadPolicy) => {
    const updated = saveMediaStoragePrefs({ [key]: val });
    setPrefs(updated);
    toast.success(`Updated ${key} download policy`);
  };

  const updateRetention = (val: CacheRetention) => {
    const updated = saveMediaStoragePrefs({ cacheRetention: val });
    setPrefs(updated);
    toast.success(`Media cache retention set to ${val}`);
  };

  const handleClearCache = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await clearMediaCache();
      const nextEst = await estimateCachedMediaStorage();
      setStorageEstimate(nextEst);
      toast.success("Media cache cleared successfully! Free space reclaimed.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-6 text-foreground">
      {/* Current Network Status Card */}
      <div className="p-4 rounded-2xl bg-secondary/50 border border-border/80 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-snap/15 border border-snap/30 flex items-center justify-center shrink-0 text-snap">
          {netInfo.type === "wifi" ? (
            <Wifi className="w-5 h-5" />
          ) : netInfo.type === "cellular" ? (
            <Smartphone className="w-5 h-5" />
          ) : (
            <Globe2 className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">Active Connection:</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-snap/20 text-snap font-semibold capitalize">
              {netInfo.type === "unknown" ? "Standard Broadband" : netInfo.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {netInfo.isReliable
              ? "Your operating system reported a verified connection type. Auto-download is configured accordingly."
              : "Connection type detection is limited on standard desktop browsers. A safe policy defaults to preview-only on low-bandwidth networks."}
          </p>
        </div>
      </div>

      {/* Auto-Download Settings */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-snap" />
          <span>Automatic Media Download</span>
        </h3>

        {/* When on Wi-Fi */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">When connected to Wi-Fi</div>
                <div className="text-xs text-muted-foreground">High-speed unmetered networks</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-2">
            {(
              [
                { id: "auto", label: "Auto (Fast)" },
                { id: "preview_only", label: "Preview only" },
                { id: "never", label: "Never" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updatePolicy("wifi", opt.id)}
                className={`py-2 px-2 text-xs font-semibold rounded-xl transition border text-center ${
                  prefs.wifi === opt.id
                    ? "bg-snap text-snap-foreground border-transparent shadow-sm"
                    : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* When on Mobile / Cellular */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">When using cellular / mobile data</div>
                <div className="text-xs text-muted-foreground">Saves data allowance and battery</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-2">
            {(
              [
                { id: "preview_only", label: "Preview only" },
                { id: "auto", label: "Auto" },
                { id: "never", label: "Never" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updatePolicy("cellular", opt.id)}
                className={`py-2 px-2 text-xs font-semibold rounded-xl transition border text-center ${
                  prefs.cellular === opt.id
                    ? "bg-snap text-snap-foreground border-transparent shadow-sm"
                    : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* When Roaming */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">When roaming internationally</div>
                <div className="text-xs text-muted-foreground">Avoid expensive roaming charges</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            {(
              [
                { id: "never", label: "Never (Recommended)" },
                { id: "preview_only", label: "Preview only" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updatePolicy("roaming", opt.id)}
                className={`py-2 px-2 text-xs font-semibold rounded-xl transition border text-center ${
                  prefs.roaming === opt.id
                    ? "bg-snap text-snap-foreground border-transparent shadow-sm"
                    : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Storage Management & Cache Section */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-snap" />
          <span>Storage Management</span>
        </h3>

        {/* Backend Server Storage Overview */}
        <div className="p-4 rounded-2xl bg-secondary/50 border border-snap/30 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-snap/20 text-snap flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Backend Cloud Server Storage
                </div>
                <div className="text-xl font-black font-display text-foreground mt-0.5">
                  188 GB Available <span className="text-xs text-snap font-normal">(99% Free)</span>
                </div>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-snap/15 border border-snap/30 text-snap text-[11px] font-bold">
              Healthy
            </span>
          </div>

          {/* Disk usage bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div className="bg-snap h-full rounded-full" style={{ width: "1%" }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Used: 1.2 GB</span>
              <span>Total Capacity: 189 GB</span>
            </div>
          </div>
        </div>

        {/* Device Cache */}
        <div className="p-4 rounded-2xl bg-secondary/40 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Device Media & Comic Cache</div>
              <div className="text-2xl font-black font-display tracking-tight text-foreground mt-0.5">
                {storageEstimate.formatted}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearCache}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-destructive/15 text-destructive hover:bg-destructive/25 font-bold text-xs transition border border-destructive/20 active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearing ? "Clearing…" : "Clear Cache"}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2 text-[11px] text-muted-foreground border-t border-border/60">
            <span>📷 Images: {Math.round(storageEstimate.imageBytes / 1024)} KB</span>
            <span>•</span>
            <span>🎥 Videos: {Math.round(storageEstimate.videoBytes / 1024)} KB</span>
            <span>•</span>
            <span>🎙️ Audio: {Math.round(storageEstimate.audioBytes / 1024)} KB</span>
          </div>
        </div>

        {/* Nigerian Pidgin Offline Voice Tester */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Offline Voice Alert (Nigerian Pidgin)</div>
              <div className="text-xs text-muted-foreground">"You no get internet again o! Check your connection…"</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playOfflineVoiceAlert();
              toast.info("Playing Nigerian Pidgin alert…");
            }}
            className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-bold transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-snap" />
            <span>Test Voice</span>
          </button>
        </div>

        {/* Cache Retention Period */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold">Cache Retention Period</div>
              <div className="text-xs text-muted-foreground">Keep cached files locally for:</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {(
              [
                { id: "3days", label: "3 Days" },
                { id: "1week", label: "1 Week" },
                { id: "1month", label: "1 Month" },
                { id: "forever", label: "Forever" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateRetention(opt.id)}
                className={`py-2 px-1 text-xs font-semibold rounded-xl transition border text-center ${
                  prefs.cacheRetention === opt.id
                    ? "bg-snap text-snap-foreground border-transparent shadow-sm"
                    : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-secondary/20 border border-border/50 flex items-start gap-2.5 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Clearing your local media cache frees space on your device. All your sent and received Flicks remain safe in your cloud history and can be reloaded at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
