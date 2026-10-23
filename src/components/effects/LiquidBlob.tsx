import { useEffect, useRef } from "react";
import gsap from "gsap";

/** Morphing SVG blob. Purely decorative, sits behind content. */
export function LiquidBlob({ className = "", color = "#C5E863", opacity = 0.35 }: { className?: string; color?: string; opacity?: number }) {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const shapes = [
      "M421,318Q407,386,342,417Q277,448,207,428Q137,408,101,344Q65,280,97,214Q129,148,197,113Q265,78,335,108Q405,138,421,209Q437,280,421,318Z",
      "M410,320Q380,390,310,412Q240,434,175,405Q110,376,90,308Q70,240,110,180Q150,120,220,102Q290,84,355,120Q420,156,425,220Q430,284,410,320Z",
      "M430,300Q420,370,352,415Q284,460,210,430Q136,400,110,330Q84,260,120,195Q156,130,225,110Q294,90,360,120Q426,150,440,215Q454,280,430,300Z",
    ];
    const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 6, ease: "sine.inOut" } });
    shapes.forEach((d) => tl.to(el, { attr: { d } }));
    return () => { tl.kill(); };
  }, []);
  return (
    <svg viewBox="0 0 500 500" className={`absolute pointer-events-none ${className}`} style={{ opacity, filter: "blur(30px)" }} aria-hidden>
      <path ref={ref} fill={color}
        d="M421,318Q407,386,342,417Q277,448,207,428Q137,408,101,344Q65,280,97,214Q129,148,197,113Q265,78,335,108Q405,138,421,209Q437,280,421,318Z" />
    </svg>
  );
}