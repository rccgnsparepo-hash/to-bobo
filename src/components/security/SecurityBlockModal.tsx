import { motion } from "framer-motion";
import { ShieldX, AlertOctagon, HelpCircle, ArrowRight, X, ExternalLink } from "lucide-react";
import type { SecurityEvaluation } from "@/lib/securityService";

interface Props {
  isOpen: boolean;
  evaluation: SecurityEvaluation;
  email: string;
  onClose: () => void;
}

export function SecurityBlockModal({ isOpen, evaluation, email, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-zinc-950 border border-rose-900/40 rounded-3xl p-6 shadow-2xl relative text-zinc-100 overflow-hidden"
      >
        {/* Top Glow Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-600 via-red-500 to-rose-600" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Shield Icon */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mb-4">
          <ShieldX className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mb-2">
          Registration Blocked
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          Flick’s multi-layered abuse prevention system detected high-risk activity linked to this registration attempt. Account creation has been held to safeguard our community.
        </p>

        {/* Reason card */}
        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 mb-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Detection Reasons:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-zinc-300">
            {evaluation.reasons && evaluation.reasons.length > 0 ? (
              evaluation.reasons.map((r, i) => <li key={i}>{r}</li>)
            ) : (
              <li>Repeated account creation attempts detected on this device cluster.</li>
            )}
          </ul>
        </div>

        {/* Action Button */}
        <div className="space-y-2">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Close</span>
          </button>
        </div>

        <div className="mt-4 text-center">
          <span className="text-[11px] text-zinc-500">
            Believe this is an error? Contact{" "}
            <a href="mailto:faratechinc@gmail.com" className="text-zinc-400 underline hover:text-zinc-200">
              safety@flick.app
            </a>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
