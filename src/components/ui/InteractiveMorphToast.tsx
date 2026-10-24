import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, Check, X, RotateCcw } from "lucide-react";
import { triggerLightHaptic } from "@/lib/haptics";

export type MorphToastOptions = {
  id?: string;
  message: string;
  count?: number;
  durationMs?: number;
  onUndo?: () => void;
};

let globalTriggerUndoToast: ((opts: MorphToastOptions) => void) | null = null;

export function triggerUndoToast(opts: MorphToastOptions) {
  if (globalTriggerUndoToast) {
    globalTriggerUndoToast(opts);
  }
}

export function InteractiveMorphToast() {
  const [current, setCurrent] = useState<MorphToastOptions | null>(null);
  const [isUndone, setIsUndone] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    globalTriggerUndoToast = (opts: MorphToastOptions) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrent(opts);
      setIsUndone(false);

      timerRef.current = window.setTimeout(() => {
        setCurrent(null);
      }, opts.durationMs || 5000);
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      globalTriggerUndoToast = null;
    };
  }, []);

  const handleUndo = () => {
    if (!current || isUndone) return;
    void triggerLightHaptic();
    setIsUndone(true);
    current.onUndo?.();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCurrent(null);
      setIsUndone(false);
    }, 2200);
  };

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrent(null);
    setIsUndone(false);
  };

  return (
    <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[99990] pointer-events-none">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            layout
            key={isUndone ? "undone" : "active"}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 480, damping: 30 }}
            className="pointer-events-auto shadow-2xl"
          >
            {isUndone ? (
              /* Morphing "Unsent" State (from video) */
              <motion.div
                layout
                className="bg-[#181820]/95 text-amber-300 border border-amber-500/30 backdrop-blur-2xl px-4 py-2.5 rounded-full flex items-center gap-2.5 shadow-[0_10px_30px_rgba(245,158,11,0.2)] text-xs font-bold"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <RotateCcw className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: "1s" }} />
                </div>
                <span>Unsent</span>
              </motion.div>
            ) : (
              /* Initial "Message sent · Undo" State (from video) */
              <motion.div
                layout
                className="bg-[#0f1118]/95 text-white border border-white/20 backdrop-blur-2xl pl-4 pr-2 py-2 rounded-full flex items-center gap-3 shadow-[0_15px_35px_rgba(0,0,0,0.7)] text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-white/90">
                    {current.message}
                    {current.count && current.count > 1 ? ` x${current.count}` : ""}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="px-3 py-1 rounded-full bg-snap text-black font-extrabold text-xs hover:brightness-105 active:scale-95 transition flex items-center gap-1 shadow-sm"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Undo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-white/40 hover:text-white transition"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
