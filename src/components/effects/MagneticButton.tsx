import { useEffect, useRef, type ReactNode, type MouseEvent } from "react";
import gsap from "gsap";

/** Cursor-magnetic wrapper. No-op on touch/reduced-motion. */
export function MagneticButton({
  children, className = "", strength = 0.35, onClick, as: As = "button", ariaLabel,
}: {
  children: ReactNode; className?: string; strength?: number;
  onClick?: (e: MouseEvent) => void; as?: "button" | "div" | "a"; ariaLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.4, ease: "power3.out" });
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1,0.4)" });
    el.addEventListener("pointermove", move as EventListener);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move as EventListener); el.removeEventListener("pointerleave", leave); };
  }, [strength]);

  const Cmp = As as "button";
  return (
    <Cmp ref={ref as React.RefObject<HTMLButtonElement>} onClick={onClick} aria-label={ariaLabel} className={`inline-flex will-change-transform ${className}`}>
      {children}
    </Cmp>
  );
}