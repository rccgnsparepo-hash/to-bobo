import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { Composer } from "@/components/Composer";

interface FlickPostModalProps {
  open: boolean;
  onClose: () => void;
}

export function FlickPostModal({ open, onClose }: FlickPostModalProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-xl bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/80 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-snap/15 text-snap grid place-items-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">What's flickering?</h3>
                <p className="text-[11px] text-muted-foreground">Share a thought, photo, video, audio or link</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Composer Body */}
          <div className="p-2 overflow-y-auto max-h-[calc(92vh-60px)]">
            <Composer
              onPosted={() => {
                onClose();
                window.dispatchEvent(new CustomEvent("flick:feed-refresh"));
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
