import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, X, Mic, Volume2 } from "lucide-react";
import {
  subscribeGlobalAudio,
  toggleGlobalAudio,
  seekGlobalAudio,
  closeGlobalAudio,
  type GlobalAudioState,
} from "@/lib/globalAudio";
import { Avatar } from "@/components/Avatar";

export function GlobalAudioOverlay() {
  const [audio, setAudio] = useState<GlobalAudioState | null>(null);

  useEffect(() => {
    const unsub = subscribeGlobalAudio(setAudio);
    return unsub;
  }, []);

  if (!audio || !audio.isVisible || !audio.src) {
    return null;
  }

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seekGlobalAudio(pos);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="fixed bottom-20 lg:bottom-6 inset-x-4 max-w-md mx-auto z-50 pointer-events-auto"
      >
        <div className="bg-[#121318]/95 border border-white/20 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl flex items-center gap-3 text-white">
          {/* Avatar or Mic Icon */}
          <div className="relative shrink-0">
            {audio.senderAvatar ? (
              <Avatar url={audio.senderAvatar} name={audio.senderName} size={40} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-snap/20 border border-snap/40 grid place-items-center text-snap">
                <Mic className="w-5 h-5" />
              </div>
            )}
            {audio.isPlaying && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-snap border-2 border-black animate-pulse" />
            )}
          </div>

          {/* Title, Scrubber, Time */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold truncate text-white leading-tight">
                {audio.senderName}
              </span>
              <span className="text-[10px] tabular-nums font-mono text-white/70">
                {fmt(audio.currentTime)} / {fmt(audio.duration)}
              </span>
            </div>

            {/* Clickable waveform scrubber */}
            <div
              onClick={handleSeek}
              className="h-2 rounded-full bg-white/15 overflow-hidden cursor-pointer relative"
              title="Seek audio position"
            >
              <div
                className="h-full bg-snap rounded-full transition-all duration-100"
                style={{ width: `${Math.min(100, Math.max(0, audio.progress * 100))}%` }}
              />
            </div>
          </div>

          {/* Controls: Play/Pause and Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleGlobalAudio}
              className="w-8 h-8 rounded-full bg-snap text-black grid place-items-center hover:opacity-90 active:scale-95 transition shadow-md"
              aria-label={audio.isPlaying ? "Pause audio" : "Play audio"}
            >
              {audio.isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={closeGlobalAudio}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white grid place-items-center transition"
              aria-label="Dismiss audio player"
              title="Close player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
