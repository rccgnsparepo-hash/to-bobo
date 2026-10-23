import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

/** 3D pointer-tilt card with glare. Uses deviceorientation on mobile if available. */
export function TiltCard({ children, className = "", max = 12 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    gsap.set(el, { transformPerspective: 900, transformStyle: "preserve-3d" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, { rotateY: px * max, rotateX: -py * max, duration: 0.4, ease: "power3.out" });
      el.style.setProperty("--glareX", `${(px + 0.5) * 100}%`);
      el.style.setProperty("--glareY", `${(py + 0.5) * 100}%`);
    };
    const leave = () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1,0.5)" });
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [max]);
  return (
    <div ref={ref} className={`relative will-change-transform ${className}`}
      style={{ backgroundImage: "radial-gradient(circle at var(--glareX,50%) var(--glareY,50%), rgba(255,255,255,0.10), transparent 45%)" }}>
      {children}
    </div>
  );
}