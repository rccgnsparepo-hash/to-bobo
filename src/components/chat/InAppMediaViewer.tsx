import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  AlertCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { downloadMedia } from "@/lib/downloadMedia";
import { toast } from "sonner";

export type InAppMediaViewerProps = {
  open: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  mediaType: "image" | "video" | "audio" | "file";
  caption?: string | null;
  sender?: {
    id?: string;
    display_name?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
  };
  timestamp?: string;
};

export function InAppMediaViewer({
  open,
  onClose,
  mediaUrl,
  mediaType,
  caption,
  sender,
  timestamp,
}: InAppMediaViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video controls state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Reset transforms whenever opened
  useEffect(() => {
    if (open) {
      setScale(1);
      setRotation(0);
      setLoading(true);
      setError(false);
      setIsPlaying(false);
    }
  }, [open, mediaUrl]);

  // Handle keyboard shortcuts (Escape to close, Space to pause video)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === " " && mediaType === "video") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(3, s + 0.25));
      } else if (e.key === "-") {
        setScale((s) => Math.max(0.5, s - 0.25));
      } else if (e.key === "0") {
        setScale(1);
        setRotation(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mediaType, isPlaying]);

  if (!open || !mediaUrl) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleDownload = () => {
    if (!mediaUrl) return;
    const name = sender?.display_name ? `flick-${sender.display_name.replace(/\s+/g, "_")}` : "flick-media";
    void downloadMedia(mediaUrl, name, mediaType);
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-2xl flex flex-col justify-between select-none text-white overflow-hidden"
      >
        {/* Top Floating Control Bar */}
        <header className="relative z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
          {/* Sender metadata info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 -ml-1 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition"
              title="Close viewer (Esc)"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <Avatar url={sender?.avatar_url} name={sender?.display_name || "Sender"} size={36} />
            <div className="min-w-0">
              <div className="text-sm font-bold truncate text-white leading-tight">
                {sender?.display_name || "Flick Media"}
              </div>
              <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
                <span>@{sender?.handle || "user"}</span>
                {timestamp && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3 inline" />
                      {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Viewing Tools */}
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full px-2 py-1 shadow-lg">
            {mediaType === "image" && (
              <>
                <button
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                  className="p-1.5 text-zinc-300 hover:text-white rounded-full transition"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-zinc-300 px-1 font-semibold">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(3, s + 0.25))}
                  className="p-1.5 text-zinc-300 hover:text-white rounded-full transition"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 text-zinc-300 hover:text-white rounded-full transition"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-zinc-300 hover:text-white rounded-full transition"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 text-snap hover:text-snap/80 rounded-full transition"
              title="Save to device"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Center Media Viewport */}
        <main
          className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden cursor-grab active:cursor-grabbing"
          onClick={(e) => {
            // Close when clicking the backdrop
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-7 h-7 text-snap animate-spin" />
              <span className="text-xs text-zinc-400 font-medium tracking-wide">Loading media…</span>
            </div>
          )}

          {error && (
            <div className="p-8 text-center max-w-sm rounded-3xl bg-zinc-900/90 border border-white/10 space-y-3 shadow-2xl">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h3 className="font-bold text-sm text-white">Media Unavailable</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Could not load the media. The temporary access token may have expired or you may be offline.
              </p>
              <button
                onClick={() => {
                  setError(false);
                  setLoading(true);
                }}
                className="px-4 py-2 rounded-full bg-snap text-black font-bold text-xs hover:opacity-90 transition"
              >
                Retry
              </button>
            </div>
          )}

          {!error && mediaType === "image" && (
            <motion.img
              src={mediaUrl}
              alt={caption || "Flick photo"}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                transition: "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
              className="max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl drop-shadow-2xl"
              draggable={false}
            />
          )}

          {!error && mediaType === "video" && (
            <div className="relative max-h-[82vh] max-w-full flex flex-col items-center">
              <video
                ref={videoRef}
                src={mediaUrl}
                playsInline
                muted={isMuted}
                onLoadedData={() => {
                  setLoading(false);
                  if (videoRef.current) setDuration(videoRef.current.duration);
                }}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlay}
                className="max-h-[76vh] max-w-full rounded-2xl bg-black/60 shadow-2xl cursor-pointer"
              />

              {/* Video Player Floating Scrubbing Dock */}
              <div className="w-full max-w-xl mt-3 px-4 py-2.5 rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-white/10 flex items-center gap-3 shadow-2xl">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-2 rounded-full bg-snap text-black hover:scale-105 active:scale-95 transition shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                </button>

                <span className="text-[11px] font-mono text-zinc-300 tabular-nums shrink-0">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    setCurrentTime(next);
                    if (videoRef.current) videoRef.current.currentTime = next;
                  }}
                  className="flex-1 accent-snap h-1.5 rounded-lg bg-white/20 cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  className="p-1.5 text-zinc-300 hover:text-white rounded-full transition shrink-0"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Playback speed selector */}
                <button
                  type="button"
                  onClick={() => {
                    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
                    setPlaybackRate(nextRate);
                    if (videoRef.current) videoRef.current.playbackRate = nextRate;
                  }}
                  className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-mono font-bold hover:bg-white/20 text-zinc-200"
                >
                  {playbackRate}x
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Caption Pill */}
        {caption && (
          <footer className="relative z-30 max-w-xl mx-auto mb-4 px-5 py-2.5 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/10 text-center text-sm text-zinc-100 shadow-xl">
            {caption}
          </footer>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
