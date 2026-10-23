import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ZoomIn, ZoomOut, RotateCcw, Share2 } from "lucide-react";
import { downloadMedia } from "@/lib/downloadMedia";
import { toast } from "sonner";

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  mediaType: "image" | "video" | "audio" | string;
  senderName?: string;
  timestamp?: string;
}

export function MediaViewerModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  senderName,
  timestamp,
}: MediaViewerModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset zoom on open or media change
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
    }
  }, [isOpen, mediaUrl]);

  // Keyboard shortcut listener: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mediaUrl) return null;

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadMedia(mediaUrl, `flick-${Date.now()}`, mediaType);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Flick from ${senderName || "Friend"}`,
          url: mediaUrl,
        });
      } catch {
        /* user cancelled share */
      }
    } else {
      await navigator.clipboard.writeText(mediaUrl);
      toast.success("Media link copied to clipboard!");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex flex-col justify-between select-none"
        onClick={onClose}
      >
        {/* Top Control Bar */}
        <header
          className="relative z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/80 to-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <div className="text-white text-sm font-bold tracking-tight">
                {senderName ? `${senderName}'s Flick` : "Flick Media"}
              </div>
              {timestamp && (
                <div className="text-zinc-400 text-xs">
                  {new Date(timestamp).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {mediaType === "image" && (
              <>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.5))}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                {zoomLevel !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-snap text-snap-foreground font-bold text-xs tracking-wide shadow-lg hover:opacity-90 active:scale-95 transition"
              title="Download to device"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? "Saving…" : "Save"}</span>
            </button>
          </div>
        </header>

        {/* Center Media Stage */}
        <div
          className="flex-1 flex items-center justify-center p-4 overflow-hidden relative"
          onClick={(e) => {
            // Clicking outside media closes, clicking media toggles
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {mediaType === "video" ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[82vh] max-w-full rounded-2xl shadow-2xl object-contain bg-black"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <motion.div
              animate={{ scale: zoomLevel }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative max-h-[82vh] max-w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={mediaUrl}
                alt="Flick"
                className="max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl transition-transform"
                draggable={false}
              />
            </motion.div>
          )}
        </div>

        {/* Bottom subtle hint */}
        <footer className="text-center pb-5 pt-2 text-zinc-500 text-xs">
          Tap outside or press ESC to dismiss · Tap Save to keep to device
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
