import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Interactive scroll helper on desktop: scroll down to explore flicks, or jump back to top. */
export function ScrollHint() {
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const vp = document.querySelector<HTMLElement>("[data-app-viewport]");
    if (!vp) return;
    const onScroll = () => setScrollTop(vp.scrollTop);
    vp.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => vp.removeEventListener("scroll", onScroll);
  }, []);

  const isAtTop = scrollTop < 160;

  const handleClick = useCallback(() => {
    const vp = document.querySelector<HTMLElement>("[data-app-viewport]");
    if (!vp) return;
    if (isAtTop) {
      vp.scrollBy({ top: 560, behavior: "smooth" });
    } else {
      vp.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [isAtTop]);

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        onClick={handleClick}
        aria-label={isAtTop ? "Scroll to explore flicks" : "Scroll back to top"}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        className="hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-30 items-center gap-2 rounded-full card-glass px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-snap/40 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isAtTop ? (
          <>
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <ChevronDown className="w-4 h-4 text-snap" />
            </motion.span>
            <span>Scroll to explore more flicks</span>
          </>
        ) : (
          <>
            <motion.span
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <ChevronUp className="w-4 h-4 text-snap" />
            </motion.span>
            <span>Back to top</span>
          </>
        )}
      </motion.button>
    </AnimatePresence>
  );
}
