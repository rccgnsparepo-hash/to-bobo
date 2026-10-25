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
  Activity,
  Flame,
} from "lucide-react";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";

export default function IntroPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [step, setStep] = useState<"slash" | "countdown" | "reveal" | "ready">("slash");
  const [countdown, setCountdown] = useState(3);
  const [isMuted, setIsMuted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

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

  // Audio synthesis helper for laser, countdown blips, and drop
  const playSynthesizedIntroSound = useCallback(
    (type: "laser" | "blip" | "impact" | "chime") => {
      if (isMuted || typeof window === "undefined") return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const t0 = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.35, t0);
        master.connect(ctx.destination);

        if (type === "laser") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(1400, t0);
          osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.35);
          gain.gain.setValueAtTime(0.4, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.36);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t0);
          osc.stop(t0 + 0.38);
        } else if (type === "blip") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, t0);
          gain.gain.setValueAtTime(0.3, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t0);
          osc.stop(t0 + 0.09);
        } else if (type === "impact") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(160, t0);
          osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.5);
          gain.gain.setValueAtTime(0.6, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t0);
          osc.stop(t0 + 0.56);
        } else if (type === "chime") {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = t0 + i * 0.07;
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
            osc.connect(gain);
            gain.connect(master);
            osc.start(start);
            osc.stop(start + 0.42);
          });
        }
      } catch {}
    },
    [isMuted]
  );

  // Background particle & neon light matrix on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
    }[] = [];

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        size: Math.random() * 2.5 + 1,
        color: Math.random() > 0.4 ? "#C5E863" : "#ef4444",
        alpha: Math.random() * 0.7 + 0.2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Cyber grid background
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw floating neon particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Main Intro Choreography
  useEffect(() => {
    // 1. Initial Laser Slash
    playSynthesizedIntroSound("laser");
    void triggerLightHaptic();

    const t1 = setTimeout(() => {
      setStep("countdown");
      playSynthesizedIntroSound("blip");
    }, 700);

    const t2 = setTimeout(() => {
      setCountdown(2);
      playSynthesizedIntroSound("blip");
    }, 1400);

    const t3 = setTimeout(() => {
      setCountdown(1);
      playSynthesizedIntroSound("blip");
    }, 2100);

    const t4 = setTimeout(() => {
      setStep("reveal");
      playSynthesizedIntroSound("impact");
      void triggerSuccessHaptic();
      setTimeout(() => playSynthesizedIntroSound("chime"), 300);
    }, 2800);

    const t5 = setTimeout(() => {
      setStep("ready");
    }, 3900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [playSynthesizedIntroSound]);

  const restartAnimation = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerLightHaptic();
    setStep("slash");
    setCountdown(3);
    playSynthesizedIntroSound("laser");

    setTimeout(() => {
      setStep("countdown");
      playSynthesizedIntroSound("blip");
    }, 700);
    setTimeout(() => {
      setCountdown(2);
      playSynthesizedIntroSound("blip");
    }, 1400);
    setTimeout(() => {
      setCountdown(1);
      playSynthesizedIntroSound("blip");
    }, 2100);
    setTimeout(() => {
      setStep("reveal");
      playSynthesizedIntroSound("impact");
    }, 2800);
    setTimeout(() => {
      setStep("ready");
    }, 3900);
  };

  return (
    <main
      onClick={() => {
        if (step === "ready") proceed();
      }}
      className="fixed inset-0 z-[9999] bg-black text-white overflow-hidden flex flex-col justify-between select-none cursor-pointer"
    >
      {/* Background Canvas Particles & Cyber Ambient Grid */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Radial Neon Core Lighting */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,rgba(197,232,99,0.12)_0%,rgba(239,68,68,0.08)_40%,transparent_75%)]" />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)] pointer-events-none z-0" />

      {/* Top Cyber Telemetry Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 flex items-center justify-between p-6 md:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-white/20 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-bold tracking-wider text-red-400">
              SYS // FLICK KINETIC LAUNCH
            </span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-snap px-2.5 py-1 rounded-full bg-snap/10 border border-snap/30 backdrop-blur-sm">
            <Zap className="w-3 h-3" />
            <span>NEURAL SOCIAL</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Center Cinematic Stage */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {/* Reticle corner brackets */}
        <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-500/80" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-red-500/80" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-red-500/80" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-red-500/80" />

          {/* Phase 1: Diagonal Laser Slash */}
          <AnimatePresence>
            {step === "slash" && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0, rotate: -35 }}
                animate={{ opacity: 1, scaleX: 1.5, rotate: -35 }}
                exit={{ opacity: 0, scale: 2 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-[180%] h-2 bg-gradient-to-r from-transparent via-white via-snap to-transparent shadow-[0_0_40px_#C5E863,0_0_80px_#ef4444]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase 2: Cyber Telemetry Countdown */}
          <AnimatePresence mode="wait">
            {step === "countdown" && (
              <motion.div
                key={countdown}
                initial={{ scale: 2.2, opacity: 0, filter: "blur(10px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                exit={{ scale: 0.6, opacity: 0, filter: "blur(8px)" }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center justify-center text-center"
              >
                <div className="font-mono text-7xl sm:text-8xl font-black text-white tracking-widest drop-shadow-[0_0_35px_rgba(239,68,68,0.8)]">
                  0{countdown}
                </div>
                <div className="mt-2 text-xs font-mono uppercase tracking-[0.3em] text-red-400">
                  Initializing Flux Engine
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase 3 & 4: Monumental FLICK Climax Reveal */}
          <AnimatePresence>
            {(step === "reveal" || step === "ready") && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
                className="flex flex-col items-center justify-center text-center relative"
              >
                {/* Glowing Aura Ring */}
                <div className="absolute w-56 h-56 rounded-full bg-snap/20 blur-3xl pointer-events-none animate-pulse" />

                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-snap/20 border border-snap/40 text-snap text-xs font-bold tracking-wider uppercase mb-3">
                  <Flame className="w-3.5 h-3.5 fill-snap" />
                  <span>The Live Social Stream</span>
                </div>

                <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-white drop-shadow-[0_0_50px_rgba(197,232,99,0.7)] flex items-center justify-center">
                  <span>FLICK</span>
                  <span className="text-snap">.</span>
                </h1>

                <p className="text-sm md:text-base text-white/70 font-sans tracking-wide mt-2 max-w-xs">
                  Share moments, stories, and chats instantly.
                </p>

                {step === "ready" && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-6 flex flex-col items-center gap-3 pointer-events-auto"
                  >
                    <button
                      onClick={proceed}
                      className="px-8 py-3.5 rounded-2xl bg-snap text-snap-foreground font-extrabold text-sm uppercase tracking-wider shadow-[0_0_40px_rgba(197,232,99,0.5)] hover:brightness-110 active:scale-95 transition flex items-center gap-2"
                    >
                      <span>Enter Flick</span>
                      <ArrowRight className="w-4 h-4 stroke-[3]" />
                    </button>
                    <button
                      onClick={restartAnimation}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white/70 hover:text-white transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Replay Intro</span>
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Footer Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="relative z-20 p-6 md:p-8 flex items-center justify-between"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
            triggerLightHaptic();
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/60 hover:bg-black/80 border border-white/20 backdrop-blur-md text-xs font-bold tracking-wide transition active:scale-95 cursor-pointer"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-red-400" />
              <span className="text-white/70">Audio Off</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-snap" />
              <span className="text-white">Sound Synthesizer Active</span>
            </>
          )}
        </button>

        <div className="text-xs text-white/50 font-mono tracking-widest uppercase">
          Flick v2.2.0 • 2026
        </div>
      </motion.div>

      {/* Iris Shutter Exit Transition */}
      <AnimatePresence>
        {isExiting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.4 }}
            exit={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-50 bg-black flex items-center justify-center pointer-events-none"
          >
            <div className="w-40 h-40 rounded-full bg-snap blur-3xl animate-ping" />
            <h1 className="font-display text-7xl md:text-9xl text-snap tracking-wider font-black">
              FLICK
            </h1>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}