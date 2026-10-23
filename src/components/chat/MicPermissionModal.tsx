import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, AlertCircle, Sparkles, Check, X, ShieldAlert, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type MicErrorInfo } from "@/lib/audioRecorder";

interface MicPermissionModalProps {
  open: boolean;
  errorInfo?: MicErrorInfo | null;
  onClose: () => void;
  onRetry: () => Promise<boolean>;
  onSendDemoVN?: () => void;
}

export function MicPermissionModal({
  open,
  errorInfo,
  onClose,
  onRetry,
  onSendDemoVN,
}: MicPermissionModalProps) {
  const [retrying, setRetrying] = useState(false);

  if (!open) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const success = await onRetry();
      if (success) {
        toast.success("Microphone permission granted! 🎙️");
        onClose();
      } else {
        toast.error("Microphone is still blocked. Please check site settings.");
      }
    } catch {
      toast.error("Could not request microphone. Please check browser settings.");
    } finally {
      setRetrying(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Dialog Content */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-card border-2 border-border rounded-3xl p-6 shadow-2xl overflow-hidden z-10"
        >
          {/* Header Icon */}
          <div className="flex items-center justify-between mb-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-snap/20 border border-snap/40 grid place-items-center text-snap">
                <Mic className="w-7 h-7" />
              </div>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black grid place-items-center text-xs font-black">
                !
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 grid place-items-center text-muted-foreground hover:text-foreground transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className="font-display text-xl font-bold text-foreground">
            {errorInfo?.title || "Microphone Permission Needed"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            {errorInfo?.message ||
              "Flick needs microphone access so you can record and send instant voice notes (VN) to your friends."}
          </p>

          {/* Quick instructions box */}
          <div className="mt-4 p-3.5 rounded-2xl bg-secondary/70 border border-border/80 space-y-2 text-xs">
            <div className="font-bold flex items-center gap-1.5 text-foreground">
              <ShieldAlert className="w-4 h-4 text-snap shrink-0" />
              <span>How to allow microphone in 2 steps:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
              <li>Tap the <b className="text-foreground">Lock 🔒</b> or <b className="text-foreground">Settings ⚙️</b> icon in your browser address bar.</li>
              <li>Toggle <b className="text-foreground">Microphone</b> to <b className="text-snap font-bold">"Allow"</b>, then tap Try Again below.</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-3 rounded-full bg-snap text-snap-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 transition shadow-lg shadow-snap/20 disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              <span>{retrying ? "Requesting access..." : "Grant Microphone Access"}</span>
            </button>

            {onSendDemoVN && (
              <button
                onClick={() => {
                  onSendDemoVN();
                  onClose();
                }}
                className="w-full py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs flex items-center justify-center gap-2 transition border border-border"
              >
                <Sparkles className="w-3.5 h-3.5 text-snap" />
                <span>Send Demo Voice Note (Preview VN)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
