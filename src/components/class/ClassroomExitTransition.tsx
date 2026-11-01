import { useEffect, useRef, useState } from "react";
import { FastForward, ArrowLeft } from "lucide-react";

interface Props {
  onComplete: () => void;
  title?: string;
}

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
}

export function ClassroomExitTransition({
  onComplete,
  title = "Leaving Lecture Space",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0); // 0 to 1
  const startTimeRef = useRef<number | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      const timer = setTimeout(onComplete, 400);
      return () => clearTimeout(timer);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const numStars = 500;
    const stars: Star[] = [];
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * width,
        pz: Math.random() * width,
      });
    }

    const totalDuration = 2.0; // 2 seconds reverse warp exit

    const render = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const p = Math.min(1, elapsed / totalDuration);
      setProgress(p);

      if (p >= 1) {
        onComplete();
        return;
      }

      // Reverse warp: starts fast, slows down as we return to the Flick social world
      const currentSpeed = 30 * (1 - p * 0.8) + 1.2;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];
        star.pz = star.z;
        // Move forward through stars towards home
        star.z -= currentSpeed;

        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * width * 2;
          star.y = (Math.random() - 0.5) * height * 2;
          star.z = width;
          star.pz = width;
        }

        const k = 250 / star.z;
        const px = star.x * k + cx;
        const py = star.y * k + cy;

        const prevK = 250 / star.pz;
        const prevPx = star.x * prevK + cx;
        const prevPy = star.y * prevK + cy;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const depthAlpha = Math.min(1, Math.max(0.15, 1 - star.z / width));

          ctx.beginPath();
          ctx.moveTo(prevPx, prevPy);
          ctx.lineTo(px, py);
          ctx.strokeStyle = `rgba(160, 140, 255, ${depthAlpha * (1 - p * 0.5)})`;
          ctx.lineWidth = Math.min(2.5, (1 - star.z / width) * 3);
          ctx.stroke();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [onComplete, prefersReducedMotion]);

  const scale = 1 + (1 - progress) * 2;
  const blur = (1 - progress) * 15;
  const opacity = Math.min(1, Math.max(0, 1 - Math.abs(progress - 0.5) * 1.8));

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-between p-6 select-none overflow-hidden text-white">
      {!prefersReducedMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      )}

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4 text-[#8898ff]" />
          <span className="text-xs uppercase tracking-widest font-mono font-bold text-[#8898ff]">
            Returning to Flick Social
          </span>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="text-xs font-mono text-zinc-400 hover:text-white transition flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Skip</span>
        </button>
      </header>

      {/* Center Returning Title */}
      <div
        className="relative z-10 my-auto text-center pointer-events-none will-change-transform"
        style={{
          transform: `scale(${scale})`,
          filter: `blur(${blur}px)`,
          opacity,
          transition: "filter 0.1s linear, transform 0.1s linear",
        }}
      >
        <div className="inline-block px-3 py-1 rounded-full bg-[#ff4f8b]/20 text-[#ff80ab] border border-[#ff4f8b]/40 text-xs font-mono font-bold uppercase tracking-wider mb-4">
          World Transition
        </div>

        <h1 className="font-bricolage text-5xl sm:text-7xl md:text-8xl tracking-tight text-white uppercase drop-shadow-[0_0_40px_rgba(255,79,139,0.35)]">
          {title}
        </h1>

        <p className="mt-4 text-xs sm:text-sm font-sans text-zinc-400 tracking-wide max-w-md mx-auto">
          Reconnecting to Flick feeds, campus stories, and messaging…
        </p>
      </div>

      {/* Bottom Progress */}
      <footer className="relative z-10 w-full max-w-xs mx-auto pb-6 text-center space-y-2">
        <div className="w-full h-1.5 rounded-full bg-black/60 border border-[#2a2a32] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#4a5cff] to-[#ff4f8b] transition-all duration-75"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-zinc-500">
          DISENGAGING LECTURE PORTAL
        </div>
      </footer>
    </div>
  );
}
