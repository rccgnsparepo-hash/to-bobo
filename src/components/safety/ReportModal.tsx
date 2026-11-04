import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { submitReport, type ReportReason, type ReportTargetType } from "@/lib/safety/safetyService";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetSnippet?: string;
}

const REPORT_REASONS: { key: ReportReason; label: string; desc: string }[] = [
  { key: "spam", label: "Spam or deceptive", desc: "Commercial spam, phishing, mass automated links" },
  { key: "harassment", label: "Harassment or bullying", desc: "Targeted insults, threats, doxxing, or stalking" },
  { key: "hate", label: "Hate speech or symbols", desc: "Attacks based on protected identity, slurs, discrimination" },
  { key: "self_harm", label: "Self-harm or suicide", desc: "Encouraging or displaying self-harm or eating disorders" },
  { key: "nudity", label: "Nudity or sexual content", desc: "Explicit images, sexually suggestive media, unsolicited DMs" },
  { key: "impersonation", label: "Impersonation", desc: "Pretending to be someone else or a brand without disclosure" },
  { key: "other", label: "Other violation", desc: "Any other behavior violating Flick community guidelines" },
];

export function ReportModal({ open, onClose, targetType, targetId, targetSnippet }: ReportModalProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to file a report");
      return;
    }

    setSubmitting(true);
    const res = await submitReport({
      reporterId: user.id,
      targetType,
      targetId,
      reason: selectedReason,
      note,
    });
    setSubmitting(false);

    if (res.success) {
      setSubmitted(true);
      toast.success("Report submitted to Flick Safety Team");
      setTimeout(() => {
        setSubmitted(false);
        setNote("");
        onClose();
      }, 1500);
    } else {
      toast.error(res.error || "Failed to submit report");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report content"
          onClick={onClose}
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-card border-t sm:border border-border rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-destructive/15 text-destructive grid place-items-center">
                  <Flag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    Report {targetType}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Help us understand what's wrong with this content
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close report modal"
                className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 grid place-items-center text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {targetSnippet && (
              <div className="p-3 bg-secondary/50 rounded-2xl border border-border/60 text-xs text-muted-foreground italic truncate">
                "{targetSnippet}"
              </div>
            )}

            {submitted ? (
              <div className="py-10 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-snap mx-auto" />
                <h4 className="font-bold text-base text-foreground">Thank you for reporting</h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Our automated safety filters and moderation team have received this ticket. You will receive a notification once resolved.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Select a reason:
                  </label>
                  <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                    {REPORT_REASONS.map((r) => {
                      const isSelected = selectedReason === r.key;
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setSelectedReason(r.key)}
                          className={`w-full p-3 rounded-2xl border text-left transition flex items-start justify-between gap-3 ${
                            isSelected
                              ? "bg-destructive/15 border-destructive/60 text-foreground"
                              : "bg-secondary/40 border-border/60 hover:bg-secondary/70 text-muted-foreground"
                          }`}
                        >
                          <div>
                            <div className={`text-xs font-bold ${isSelected ? "text-destructive" : "text-foreground"}`}>
                              {r.label}
                            </div>
                            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                              {r.desc}
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 grid place-items-center ${
                              isSelected ? "border-destructive bg-destructive" : "border-muted-foreground/40"
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Additional notes (optional):
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Provide any context that will help our safety reviewers..."
                    rows={3}
                    className="w-full bg-secondary p-3 rounded-2xl text-xs border border-border focus:outline-none focus:ring-1 focus:ring-snap text-foreground resize-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <span>Submit Report</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
