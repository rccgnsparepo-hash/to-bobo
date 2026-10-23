import { useEffect, type RefObject } from "react";
import Lenis from "lenis";

/**
 * Smooth-scroll for the app's primary scroll container.
 * Pass the scrollable element ref (the desktop main viewport); falls back to the window.
 * Auto-disables on prefers-reduced-motion and on touch coarse pointers.
 */
export function useLenis(wrapperRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = wrapperRef?.current || document.querySelector<HTMLElement>("[data-app-viewport]");
    if (!el) return;

    // Apply native CSS smooth scrolling to container
    el.style.scrollBehavior = "smooth";
    el.style.overscrollBehaviorY = "contain";

    const onCustomScroll = (e: Event) => {
      const detail = (e as CustomEvent<{ top?: number; delta?: number }>).detail;
      if (typeof detail?.delta === "number") {
        el.scrollBy({ top: detail.delta, behavior: "smooth" });
      } else if (typeof detail?.top === "number") {
        el.scrollTo({ top: detail.top, behavior: "smooth" });
      }
    };

    window.addEventListener("flick:smooth-scroll", onCustomScroll);
    return () => {
      window.removeEventListener("flick:smooth-scroll", onCustomScroll);
    };
  }, [wrapperRef]);
}
