import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Camera,
  Trophy,
  Sparkles,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";

type MascotMood = "peeping" | "waving" | "dancing" | "talking";

export function PeepingFlickerMascot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const [mood, setMood] = useState<MascotMood>("peeping");
  const [speechText, setSpeechText] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(true); // Default to tucked-in edge tab so it never blocks
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("flick:hide_peep_mascot") === "true";
    } catch {
      return false;
    }
  });

  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const speechTimerRef = useRef<number | null>(null);

  // Track cursor position slightly for eye animation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isMinimized || isDismissed || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mascotCenterX = rect.left + rect.width / 2;
      const mascotCenterY = rect.top + rect.height / 2;
      const dx = (e.clientX - mascotCenterX) / window.innerWidth;
      const dy = (e.clientY - mascotCenterY) / window.innerHeight;
      setEyeOffset({
        x: Math.max(-2, Math.min(2, dx * 5)),
        y: Math.max(-1.5, Math.min(1.5, dy * 4)),
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isMinimized, isDismissed]);

  const showSpeech = (text: string, durationMs = 4000) => {
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    setSpeechText(text);
    speechTimerRef.current = window.setTimeout(() => {
      setSpeechText(null);
    }, durationMs);
  };

  const handleMascotClick = () => {
    void triggerMediumHaptic();
    const greetings = [
      `Yo ${profile?.display_name || "Flicker"}! What's popping on Flick? 🔥`,
      "Looking fly! Ready to create a new Flick? 📸",
      "Check out the top flickers on the leaderboard! 🏆",
      "Keep that streak alive! You're on fire ⚡",
    ];
    const picked = greetings[Math.floor(Math.random() * greetings.length)];
    setMood("dancing");
    showSpeech(picked);
    setTimeout(() => {
      setMood("peeping");
    }, 2000);
  };

  const handleDismissPermanently = (e: React.MouseEvent) => {
    e.stopPropagation();
    void triggerLightHaptic();
    setIsDismissed(true);
    try {
      sessionStorage.setItem("flick:hide_peep_mascot", "true");
    } catch {}
  };

  // DO NOT render inside chat threads, messages, camera, post composers, or auth
  // to ensure zero interference with text inputs, send buttons, emoji pickers, or keyboard!
  const isBlockedRoute =
    location.pathname.startsWith("/messages") ||
    location.pathname.startsWith("/camera") ||
    location.pathname.startsWith("/stories/new") ||
    location.pathname.startsWith("/intro") ||
    location.pathname.startsWith("/auth");

  if (isDismissed || isBlockedRoute) return null;

  return (
    <div
      ref={containerRef}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 select-none pointer-events-none"
    >
      <AnimatePresence>
        {isMinimized ? (
          /* Sleek edge-docked tab: Hugs the right viewport border with zero bottom obstruction */
          <motion.div
            key="edge-peep-tab"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="pointer-events-auto flex items-center bg-[#14161a]/95 border-l border-y border-[#C5E863]/30 rounded-l-2xl shadow-xl backdrop-blur-md overflow-hidden"
          >
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setIsMinimized(false);
                showSpeech("What's flickering? 👀", 3000);
              }}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-white hover:bg-white/5 transition cursor-pointer"
              title="Click to open Flicker Buddy"
            >
              <span className="w-2 h-2 rounded-full bg-[#C5E863] animate-pulse" />
              <span className="text-[11px] font-semibold tracking-tight">Buddy</span>
            </button>

            <button
              type="button"
              onClick={handleDismissPermanently}
              className="px-1.5 py-2 text-zinc-500 hover:text-white border-l border-white/10 transition cursor-pointer"
              title="Hide permanently"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ) : (
          /* Active Expanded Mascot Peeping from Edge */
          <motion.div
            key="expanded-mascot"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            className="pointer-events-auto relative mr-3 flex flex-col items-end"
          >
            {/* Interactive Speech Bubble */}
            <AnimatePresence>
              {speechText && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 10 }}
                  className="mb-2 max-w-[210px] p-3 rounded-2xl bg-[#16181d]/95 border border-[#C5E863]/40 text-white shadow-2xl backdrop-blur-xl z-50 text-xs"
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className="font-bold text-[#C5E863] text-[11px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#C5E863]" />
                      <span>Flicker Buddy</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpeechText(null);
                      }}
                      className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-zinc-200 leading-snug font-medium mb-2">{speechText}</p>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setSpeechText(null);
                        navigate("/camera");
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#C5E863] text-black font-bold text-[10px] hover:bg-[#b5dc4f] active:scale-95 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Camera className="w-2.5 h-2.5 text-black" />
                      <span>Flick</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpeechText(null);
                        navigate("/challenges");
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-bold text-[10px] hover:bg-white/20 active:scale-95 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trophy className="w-2.5 h-2.5 text-[#C5E863]" />
                      <span>Duels</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mascot SVG Body Peeping from Edge */}
            <motion.div
              animate={
                mood === "dancing"
                  ? { y: [0, -6, 0, -4, 0], rotate: [0, -3, 3, 0] }
                  : mood === "waving"
                  ? { y: [0, -3, 0], rotate: [0, 2, -2, 0] }
                  : { y: [0, -2, 0] }
              }
              transition={{ repeat: Infinity, duration: mood === "dancing" ? 0.8 : 3, ease: "easeInOut" }}
              onClick={handleMascotClick}
              className="relative w-24 h-32 sm:w-28 sm:h-36 cursor-pointer group"
              title="Click Flicker Buddy!"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#C5E863]/15 via-transparent to-transparent rounded-full blur-xl pointer-events-none group-hover:from-[#C5E863]/30 transition-all" />

              <svg
                viewBox="0 0 160 200"
                className="w-full h-full drop-shadow-2xl"
                style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.8))" }}
              >
                <defs>
                  <linearGradient id="mSkin" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8d553b" />
                    <stop offset="100%" stopColor="#5d3521" />
                  </linearGradient>
                  <linearGradient id="mHair" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6e2e18" />
                    <stop offset="50%" stopColor="#411b0e" />
                    <stop offset="100%" stopColor="#1e0c06" />
                  </linearGradient>
                  <linearGradient id="mCardigan" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2c3036" />
                    <stop offset="100%" stopColor="#17181c" />
                  </linearGradient>
                  <linearGradient id="mPants" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9aa1a9" />
                    <stop offset="100%" stopColor="#676d75" />
                  </linearGradient>
                </defs>

                {/* Torso & Cardigan */}
                <path d="M48 95 C48 95 56 165 52 175 L108 175 C104 165 112 95 112 95 Z" fill="url(#mCardigan)" />
                <polygon points="74,95 86,95 80,115" fill="#ffffff" />
                <line x1="80" y1="115" x2="80" y2="170" stroke="#45494f" strokeWidth="2" strokeDasharray="2 2" />

                {/* Legs */}
                <path d="M55 175 L62 196 L74 196 L78 175 Z" fill="url(#mPants)" />
                <path d="M82 175 L86 196 L98 196 L105 175 Z" fill="url(#mPants)" />
                <ellipse cx="68" cy="197" rx="10" ry="3.5" fill="#0d0e10" />
                <ellipse cx="92" cy="197" rx="10" ry="3.5" fill="#0d0e10" />

                {/* Arms */}
                {mood === "waving" ? (
                  <>
                    <g className="origin-[50px_100px] animate-pulse">
                      <path d="M50 100 Q30 75 42 60 Q52 70 56 95" fill="url(#mCardigan)" strokeLinecap="round" />
                      <circle cx="42" cy="56" r="7" fill="url(#mSkin)" />
                    </g>
                    <path d="M110 100 C118 120 115 145 95 140 C100 130 105 120 106 105 Z" fill="url(#mCardigan)" />
                    <circle cx="95" cy="140" r="6" fill="url(#mSkin)" />
                  </>
                ) : (
                  <>
                    <path d="M50 102 C38 122 45 145 74 140 C70 130 62 120 60 106 Z" fill="url(#mCardigan)" />
                    <path d="M110 102 C122 122 115 145 86 140 C90 130 98 120 100 106 Z" fill="url(#mCardigan)" />
                    <ellipse cx="80" cy="140" rx="8" ry="6" fill="url(#mSkin)" />
                  </>
                )}

                {/* Head & Neck */}
                <rect x="75" y="85" width="10" height="14" fill="url(#mSkin)" rx="3" />
                <ellipse cx="80" cy="62" rx="22" ry="26" fill="url(#mSkin)" />

                {/* Eyes tracking cursor */}
                <g transform={`translate(${eyeOffset.x}, ${eyeOffset.y})`}>
                  <ellipse cx="73" cy="60" rx="3.5" ry="4" fill="#ffffff" />
                  <circle cx="73" cy="60" r="2" fill="#1b120c" />
                  <ellipse cx="87" cy="60" rx="3.5" ry="4" fill="#ffffff" />
                  <circle cx="87" cy="60" r="2" fill="#1b120c" />
                </g>

                <path d="M68 54 Q73 51 78 53" stroke="#25120a" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M82 53 Q87 51 92 54" stroke="#25120a" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M79 61 L78 67 L82 67" stroke="#482415" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M74 72 Q80 78 86 72" stroke="#2e1408" strokeWidth="2.2" fill="none" strokeLinecap="round" />

                {/* Hair */}
                <ellipse cx="80" cy="44" rx="26" ry="18" fill="url(#mHair)" />
                <path d="M58 48 C52 56 54 74 57 80" stroke="url(#mHair)" strokeWidth="4.8" strokeLinecap="round" />
                <path d="M64 42 C60 52 61 70 63 84" stroke="url(#mHair)" strokeWidth="4.8" strokeLinecap="round" />
                <path d="M71 36 C70 48 70 64 69 76" stroke="url(#mHair)" strokeWidth="4.8" strokeLinecap="round" />
                <path d="M80 34 C80 46 80 62 80 74" stroke="url(#mHair)" strokeWidth="4.8" strokeLinecap="round" />
                <path d="M89 36 C90 48 90 64 91 76" stroke="url(#mHair)" strokeWidth="4.8" strokeLinecap="round" />
                <path d="M96 42 C100 52 99 70 97 84" stroke="url(#mHair)" strokeWidth="4.8" strokeLinecap="round" />
                <path d="M102 48 C108 56 106 74 103 80" stroke="url(#mHair)" strokeWidth="4.8" strokeLinecap="round" />

                {/* Flick Lime Chest Badge */}
                <circle cx="88" cy="118" r="4.5" fill="#C5E863" />
                <text x="86.5" y="120.5" fontSize="4.5" fontWeight="bold" fill="#000000">f</text>
              </svg>
            </motion.div>

            {/* Quick Tuck / Dismiss Action Pill */}
            <div className="flex items-center gap-1.5 mt-1 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-zinc-400">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerLightHaptic();
                  setIsMinimized(true);
                }}
                className="hover:text-white transition cursor-pointer"
                title="Tuck into edge tab"
              >
                Tuck away
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleDismissPermanently}
                className="hover:text-rose-400 transition cursor-pointer"
                title="Close"
              >
                Close ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
