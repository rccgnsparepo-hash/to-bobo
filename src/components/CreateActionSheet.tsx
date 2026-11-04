import { motion, AnimatePresence } from "framer-motion";
import { Plus, Camera, Radio, GraduationCap, X, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

interface CreateActionSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenPost: () => void;
}

export function CreateActionSheet({ open, onClose, onOpenPost }: CreateActionSheetProps) {
  const navigate = useNavigate();

  // Close on escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create menu"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full lg:max-w-md bg-card border-t lg:border border-border rounded-t-[32px] lg:rounded-3xl p-6 shadow-2xl space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            {/* Grab handle for mobile */}
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mx-auto -mt-2 mb-2 lg:hidden" />

            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground">Create</h3>
                <p className="text-xs text-muted-foreground">What would you like to share today?</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close create menu"
                className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 grid place-items-center text-muted-foreground hover:text-foreground transition focus-visible:ring-2 focus-visible:ring-snap focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Option 1: New post */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPost();
                }}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/60 hover:bg-secondary border border-border/80 transition text-left group focus-visible:ring-2 focus-visible:ring-snap focus:outline-none"
              >
                <div className="w-11 h-11 rounded-2xl bg-snap text-snap-foreground grid place-items-center shadow-md shadow-snap/20 group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                    <span>New post</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-snap/20 text-snap border border-snap/40">
                      Popular
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Share thoughts, photos, clips, or voice notes
                  </div>
                </div>
              </button>

              {/* Option 2: Camera */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/camera");
                }}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/60 hover:bg-secondary border border-border/80 transition text-left group focus-visible:ring-2 focus-visible:ring-snap focus:outline-none"
              >
                <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 grid place-items-center group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground">Camera & Filters</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Snap moments, apply real-time styles & post to stories
                  </div>
                </div>
              </button>

              {/* Option 3: Go live (with pulsing red dot) */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/space?tab=live");
                }}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/60 hover:bg-secondary border border-border/80 transition text-left group focus-visible:ring-2 focus-visible:ring-snap focus:outline-none"
              >
                <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 grid place-items-center relative group-hover:scale-105 transition-transform">
                  <Radio className="w-5 h-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                    <span>Go live</span>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Start a broadcast, talk to followers & receive reactions
                  </div>
                </div>
              </button>

              {/* Option 4: Slot for "Start a class" (reserved slot) */}
              <div
                aria-disabled="true"
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/30 border border-dashed border-border/70 text-left opacity-60 cursor-not-allowed select-none"
              >
                <div className="w-11 h-11 rounded-2xl bg-secondary text-muted-foreground grid place-items-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-muted-foreground flex items-center gap-2">
                    <span>Start a class</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Coming soon
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground/80 truncate">
                    Live lecture rooms, slides & interactive campus whiteboard
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
