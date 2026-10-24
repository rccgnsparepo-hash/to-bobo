import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import {
  Volume2,
  VolumeX,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";

const VIDEO_PATH = "/assets/aistudio/Video_2026_10_24-3_32c14a23.webm";

export default function IntroPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [needsGestureForAudio, setNeedsGestureForAudio] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(18.3);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  const proceed = useCallback(() => {
    if (loading || isExiting) return;
    setIsExiting(true);
    triggerSuccessHaptic();
    try {
      playSound("auth_success");
    } catch {}
    sessionStorage.setItem("flick:intro", "1");
    setTimeout(() => {
      nav(session ? "/" : "/auth", { replace: true });
    }, 450);
  }, [loading, isExiting, nav, session]);

  // Attempt video autoplay with sound, gracefully fallback to muted if blocked by browser policy
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    // Try unmuted first
    video.muted = false;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsMuted(false);
          setNeedsGestureForAudio(false);
        })
        .catch(() => {
          // Browser prevented autoplay with audio: play muted and prompt user for unmute
          video.muted = true;
          setIsMuted(true);
          setNeedsGestureForAudio(true);
          video
            .play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn("[Intro] Video playback failed:", err);
            });
        });
    }

    const handleTimeUpdate = () => {
      if (!video) return;
      setCurrentTime(video.currentTime);
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      setHasEnded(true);
      // Brief pause at climax then auto-proceed into app
      setTimeout(() => {
        proceed();
      }, 700);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [proceed]);

  const toggleSound = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    triggerLightHaptic();
    if (video.muted) {
      video.muted = false;
      setIsMuted(false);
      setNeedsGestureForAudio(false);
      if (video.paused) {
        void video.play();
      }
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const handleGlobalTap = () => {
    // If audio was blocked, global tap activates sound immediately
    if (needsGestureForAudio) {
      toggleSound();
      return;
    }
    // If ended, tap proceeds
    if (hasEnded) {
      proceed();
    }
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    triggerLightHaptic();
    setHasEnded(false);
    video.currentTime = 0;
    video.muted = false;
    setIsMuted(false);
    setNeedsGestureForAudio(false);
    void video.play();
  };

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  return (
    <main
      onClick={handleGlobalTap}
      className="fixed inset-0 z-[9999] bg-black text-white overflow-hidden flex flex-col justify-between select-none cursor-pointer"
    >
      {/* Background cinematic video */}
      <div className="absolute inset-0 z-0 bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          src={VIDEO_PATH}
          playsInline
          autoPlay
          preload="auto"
          className="w-full h-full object-cover pointer-events-none"
        />

        {/* Ambient vignette and laser glow overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)] pointer-events-none" />

        {/* Futuristic Cyber Scanlines & Grid */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Top Cyber HUD Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative z-20 flex items-center justify-between p-6 md:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/20 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-bold tracking-wider text-red-400">
              REC // FLICK KINETIC INTRO
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-white/60 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <Zap className="w-3 h-3 text-snap" />
            <span>HQ STEREO</span>
          </div>
        </div>

        {/* Time code display */}
        <div className="flex items-center gap-3 font-mono text-xs tracking-wider">
          <span className="text-white/80">
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              proceed();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-white transition active:scale-95"
          >
            <span>Skip</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Center Prompt & Reticle HUD Elements */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pointer-events-none">
        {/* Reticle corner brackets */}
        <div className="relative w-64 h-64 md:w-80 md:h-80 max-w-full flex items-center justify-center">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-red-500/80" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-red-500/80" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-red-500/80" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-red-500/80" />

          {/* Unmute Prompt Banner if autoplay muted */}
          <AnimatePresence>
            {needsGestureForAudio && !hasEnded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="pointer-events-auto cursor-pointer"
                onClick={toggleSound}
              >
                <div className="px-5 py-3 rounded-2xl bg-red-600/90 hover:bg-red-500 text-white font-black text-xs sm:text-sm tracking-wider uppercase border border-white/30 shadow-[0_0_30px_rgba(239,68,68,0.7)] backdrop-blur-xl flex items-center gap-2.5 transform hover:scale-105 transition active:scale-95">
                  <Volume2 className="w-5 h-5 animate-bounce" />
                  <span>Tap anywhere for sound 🔊</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* End Replay Prompt */}
          <AnimatePresence>
            {hasEnded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="pointer-events-auto flex flex-col items-center gap-3"
              >
                <button
                  onClick={proceed}
                  className="px-8 py-4 rounded-2xl bg-snap text-snap-foreground font-black text-base uppercase tracking-wider shadow-[0_0_40px_rgba(197,232,99,0.6)] hover:brightness-110 active:scale-95 transition flex items-center gap-2"
                >
                  <span>Enter Flick</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleReplay}
                  className="px-4 py-2 rounded-xl bg-black/60 border border-white/20 text-white/80 hover:text-white text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Replay Animation</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom HUD Controls & Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative z-20 p-6 md:p-8 space-y-4"
      >
        {/* Timeline progress line */}
        <div className="relative w-full h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-red-500 via-rose-500 to-snap rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Audio toggle */}
          <button
            onClick={toggleSound}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-black/60 hover:bg-black/80 border border-white/20 backdrop-blur-md text-xs font-bold tracking-wide transition active:scale-95 cursor-pointer"
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-red-400" />
                <span className="text-white/80">Sound Muted</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-0.5 h-3">
                  <span className="w-0.5 h-2 bg-snap animate-[pulse_0.4s_infinite]" />
                  <span className="w-0.5 h-3.5 bg-snap animate-[pulse_0.6s_infinite]" />
                  <span className="w-0.5 h-1.5 bg-snap animate-[pulse_0.5s_infinite]" />
                  <span className="w-0.5 h-3 bg-snap animate-[pulse_0.7s_infinite]" />
                </div>
                <Volume2 className="w-4 h-4 text-snap" />
                <span className="text-white">Audio Active</span>
              </>
            )}
          </button>

          {/* Quick Enter Action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              proceed();
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-snap text-snap-foreground font-black text-xs md:text-sm uppercase tracking-wider shadow-lg shadow-snap/30 hover:brightness-105 active:scale-95 transition cursor-pointer"
          >
            <span>Enter Flick</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </motion.div>

      {/* Exit Zoom Burst Transition */}
      <AnimatePresence>
        {isExiting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.5 }}
            exit={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-50 bg-black flex items-center justify-center pointer-events-none"
          >
            <div className="w-32 h-32 rounded-full bg-snap blur-3xl animate-ping" />
            <h1 className="font-display text-6xl md:text-8xl text-snap tracking-wider font-black">
              FLICK
            </h1>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}