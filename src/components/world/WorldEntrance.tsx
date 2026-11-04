import { useEffect, useRef, useState } from "react";
import { FastForward, Sparkles } from "lucide-react";

export interface WorldEntranceProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  buttonText?: string;
  onEnter: (coords?: { x: number; y: number }) => void;
  onSkip?: () => void;
  isTransitioning?: boolean;
}

export function WorldEntrance({
  title = "Flick World",
  subtitle = "Step into the live universe — audio spaces, real-time broadcasts, and social moments.",
  badge = "Flick Social Universe",
  buttonText = "Enter the world",
  onEnter,
  onSkip,
  isTransitioning = false,
}: WorldEntranceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [internalWarping, setInternalWarping] = useState(false);
  const isWarping = Boolean(isTransitioning || internalWarping);

  useEffect(() => {
    if (isTransitioning) {
      window.dispatchEvent(new CustomEvent("flick:start-warp-speed"));
    }
  }, [isTransitioning]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    let W = (cv.width = window.innerWidth);
    let H = (cv.height = window.innerHeight);

    const handleResize = () => {
      if (!cv) return;
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Drifting starfield algorithm (320 stars)
    const stars: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 320; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2 * window.innerWidth,
        y: (Math.random() - 0.5) * 2 * window.innerHeight,
        z: Math.random() * window.innerWidth,
      });
    }

    let speed = 0.6;
    let target = 0.6;
    let alive = true;

    // Listen for warp trigger
    const onTriggerWarp = () => {
      target = 70; // Warp speed from html file
    };
    window.addEventListener("flick:start-warp-speed", onTriggerWarp);

    const frame = () => {
      if (!alive) return;
      speed += (target - speed) * 0.06;

      cx.fillStyle = "rgba(10,10,10," + (speed > 6 ? 0.22 : 0.7) + ")";
      cx.fillRect(0, 0, W, H);

      for (const s of stars) {
        s.z -= speed;
        if (s.z < 1) {
          s.x = (Math.random() - 0.5) * 2 * W;
          s.y = (Math.random() - 0.5) * 2 * H;
          s.z = W;
        }

        const k = W / 2;
        const x = (s.x / s.z) * k + W / 2;
        const y = (s.y / s.z) * k + H / 2;
        const px = (s.x / (s.z + speed * 1.6)) * k + W / 2;
        const py = (s.y / (s.z + speed * 1.6)) * k + H / 2;

        const t = 1 - s.z / W;
        cx.strokeStyle = t > 0.7 ? "#9fb0ff" : "rgba(243,243,246," + (0.25 + t) + ")";
        cx.lineWidth = t * 2.6 + 0.3;
        cx.beginPath();
        cx.moveTo(px, py);
        cx.lineTo(x, y);
        cx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(frame);
    };

    animFrameRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("flick:start-warp-speed", onTriggerWarp);
    };
  }, [prefersReducedMotion]);

  const handleEnterClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    setInternalWarping(true);
    window.dispatchEvent(new CustomEvent("flick:start-warp-speed"));
    onEnter(coords);
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#0a0a0a] text-[#f3f3f6] flex flex-col items-center justify-between p-6 select-none overflow-hidden ${
        isWarping ? "go" : ""
      }`}
    >
      {/* Starfield Canvas */}
      {!prefersReducedMotion && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      )}

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4a5cff] animate-ping" />
          <span className="text-xs uppercase tracking-widest font-mono font-bold text-[#8898ff] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-snap" />
            <span>{badge}</span>
          </span>
        </div>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-mono text-zinc-400 hover:text-white transition flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 active:scale-95 cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Skip</span>
          </button>
        )}
      </header>

      {/* Center Fly-Through Title (gin fly-through warp) */}
      <div
        className="gin relative z-10 my-auto text-center will-change-transform max-w-4xl mx-auto"
        style={{
          transform: isWarping ? "scale(7)" : "none",
          filter: isWarping ? "blur(14px)" : "none",
          opacity: isWarping ? 0 : 1,
          pointerEvents: isWarping ? "none" : "auto",
          transition: "transform 1.1s cubic-bezier(.6,0,.9,.4), filter 1.1s, opacity 1s",
        }}
      >
        <h1
          className="font-bricolage text-[clamp(56px,16vw,160px)] font-extrabold uppercase leading-[0.88] tracking-[-0.03em] text-[#f3f3f6]"
          style={{ fontStretch: "75%" }}
        >
          {title}
        </h1>

        <p className="max-w-[34ch] mx-auto my-6 text-[#a9a9b8] text-base sm:text-lg font-sans">
          {subtitle}
        </p>

        {!isWarping && (
          <button
            type="button"
            onClick={handleEnterClick}
            className="enter bg-[#f3f3f6] text-[#0a0a0a] hover:bg-white rounded-full px-8 py-3.5 font-bold text-base shadow-2xl active:scale-95 transition-all cursor-pointer font-sans"
          >
            {buttonText}
          </button>
        )}
      </div>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-md mx-auto pb-6 text-center space-y-2">
        <div className="text-[11px] font-mono text-zinc-500">
          Audio Spaces · Live Streams · Real-time Moments
        </div>
      </footer>
    </div>
  );
}
