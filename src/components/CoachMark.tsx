import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useLocation } from "react-router-dom";

type Step = { match: (path: string) => boolean; target: string; title: string; body: string };

const STEPS: Step[] = [
  { match: (p) => p === "/", target: "coach-composer", title: "Want to make a post?", body: "Tap here to share a photo, video, voice note or thought." },
  { match: (p) => p.startsWith("/messages"), target: "coach-dm", title: "Disappearing DMs", body: "Search a friend and start a 24h chat. Files, voice and images all work." },
  { match: (p) => p === "/profile", target: "coach-profile", title: "Your space", body: "Upload an avatar so your face shows everywhere." },
];

export function CoachMark() {
  const { pathname } = useLocation();
  const step = STEPS.find((s) => s.match(pathname));
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!step) { setDismissed(true); return; }
    const key = `flick:coach:${step.target}`;
    if (localStorage.getItem(key)) { setDismissed(true); return; }
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-coach="${step.target}"]`) as HTMLElement | null;
      if (!el) return;
      setRect(el.getBoundingClientRect());
      setDismissed(false);
    }, 600);
    return () => clearTimeout(t);
  }, [pathname, step]);

  const close = () => {
    if (step) localStorage.setItem(`flick:coach:${step.target}`, "1");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && step && rect && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[60]"
          style={{
            background: `radial-gradient(circle at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, transparent ${Math.max(rect.width, rect.height) * 0.7}px, oklch(0 0 0 / 0.78) ${Math.max(rect.width, rect.height) * 0.9}px)`,
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute card-glass rounded-2xl p-4 shadow-2xl w-72"
            style={{
              top: Math.min(rect.bottom + 12, window.innerHeight - 200),
              left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
            }}
          >
            <button onClick={close} className="absolute top-2 right-2 text-muted-foreground"><X className="w-4 h-4" /></button>
            <div className="flex items-center gap-2 mb-1 text-snap"><Sparkles className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Tip</span></div>
            <div className="font-display text-lg leading-tight">{step.title}</div>
            <p className="text-sm text-muted-foreground mt-1">{step.body}</p>
            <button onClick={close} className="mt-3 w-full py-2 rounded-full bg-snap text-snap-foreground font-bold text-sm">Got it</button>
          </motion.div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="absolute border-2 border-snap rounded-2xl pointer-events-none"
            style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}