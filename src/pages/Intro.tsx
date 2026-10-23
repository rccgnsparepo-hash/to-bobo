import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { notificationAudio } from "@/lib/notificationAudio";
import { Volume2, Sparkles } from "lucide-react";

export default function IntroPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [audioDone, setAudioDone] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioStartedRef = useRef(false);

  const proceed = useCallback(() => {
    if (loading) return;
    nav(session ? "/" : "/auth", { replace: true });
  }, [loading, nav, session]);

  // Launch synchronized "Welcome to Flick" audio immediately upon mount
  useEffect(() => {
    if (audioStartedRef.current) return;
    audioStartedRef.current = true;

    let mounted = true;

    // Play welcome audio and wait for it to finish sounding
    notificationAudio
      .playWelcomeToFlickAudio()
      .then(() => {
        if (!mounted) return;
        setAudioDone(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAudioDone(true);
      });

    // Safety fallback: if audio is blocked or system has no sound, proceed after reasonable window
    const fallbackTimer = setTimeout(() => {
      if (mounted) setAudioDone(true);
    }, 4500);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  // When audio has finished sounding and auth state is loaded, transition to next page
  useEffect(() => {
    if (audioDone && !loading) {
      const transitTimer = setTimeout(() => {
        proceed();
      }, 300);
      return () => clearTimeout(transitTimer);
    }
  }, [audioDone, loading, proceed]);

  const handleUserTap = () => {
    setHasInteracted(true);
    if (!audioDone) {
      // Re-trigger audio in user context if browser blocked autoplay
      notificationAudio.playWelcomeToFlickAudio().finally(() => {
        setAudioDone(true);
      });
    } else {
      proceed();
    }
  };

  return (
    <main
      onClick={handleUserTap}
      className="fixed inset-0 z-50 overflow-hidden grid grid-cols-2 cursor-pointer select-none"
    >
      {/* Left noir panel */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="surface-noir relative flex flex-col justify-between p-8"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="font-display text-2xl tracking-tight text-snap"
        >
          FL
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="absolute inset-0 grid place-items-center pointer-events-none"
        >
          <div className="w-[140%] aspect-square rounded-full bg-snap/15 blur-3xl" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="relative font-display text-[18vw] md:text-[10vw] leading-[0.85] text-foreground"
        >
          flick
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="relative text-xs text-muted-foreground tracking-[0.3em] uppercase"
        >
          Share moments instantly
        </motion.p>
      </motion.div>

      {/* Right warm panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="surface-warm relative flex flex-col justify-between p-8"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-right text-xs uppercase tracking-[0.25em]"
        >
          v1 · 2026
        </motion.div>

        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative grid place-items-center"
        >
          <div className="absolute w-48 h-48 rounded-full bg-foreground/10 blur-2xl" />
          <div className="relative w-40 h-40 rounded-full border-[6px] border-foreground/80 grid place-items-center">
            <div
              className="w-28 h-28 rounded-full bg-foreground/90 grid place-items-center font-display text-5xl text-warm"
              style={{ color: "oklch(0.86 0.07 80)" }}
            >
              F
            </div>
          </div>
        </motion.div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em]">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex items-center gap-2"
            >
              <Volume2 className="w-3.5 h-3.5 text-snap animate-pulse" />
              <span>{audioDone ? "Ready" : "Welcome to Flick"}</span>
            </motion.p>
            {!hasInteracted && !audioDone && (
              <span className="text-[10px] text-muted-foreground tracking-normal font-sans normal-case">
                Tap anywhere to enter
              </span>
            )}
          </div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: audioDone ? "100%" : "85%" }}
            transition={{ duration: audioDone ? 0.3 : 2.5, ease: "easeInOut" }}
            className="h-[2px] bg-foreground/80"
          />
        </div>
      </motion.div>

      {/* Center wordmark seam */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.6, duration: 0.5 }}
        className="absolute inset-0 pointer-events-none grid place-items-center"
      >
        <span className="font-display text-3xl tracking-[0.4em] text-snap mix-blend-difference">
          FLICK
        </span>
      </motion.div>
    </main>
  );
}