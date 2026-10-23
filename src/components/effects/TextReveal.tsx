import { createElement, useEffect, useRef } from "react";
import gsap from "gsap";

/** Splits text into word-spans and reveals them with stagger on mount. */
export function TextReveal({
  text, className = "", delay = 0, as = "h1",
}: { text: string; className?: string; delay?: number; as?: "h1" | "h2" | "h3" | "p" | "span" | "div" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const words = el.querySelectorAll<HTMLSpanElement>("[data-word]");
    gsap.set(words, { yPercent: 110, opacity: 0 });
    gsap.to(words, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.06, delay, ease: "expo.out" });
  }, [text, delay]);
  return createElement(
    as,
    { ref, className },
    text.split(" ").map((w, i) =>
      createElement(
        "span",
        { key: i, className: "inline-block overflow-hidden pb-[0.06em] mr-[0.25em] align-bottom" },
        createElement("span", { "data-word": true, className: "inline-block will-change-transform" }, w)
      )
    )
  );
}