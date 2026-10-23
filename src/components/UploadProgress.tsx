import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle, Upload } from "lucide-react";

export type UploadStage = { label: string; progress: number; status: "active" | "done" | "error"; detail?: string };

export function UploadProgress({ stages, onDismiss }: { stages: UploadStage[]; onDismiss?: () => void }) {
  const visible = stages.length > 0;
  const allDone = stages.every((s) => s.status === "done");
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 card-glass rounded-2xl shadow-2xl w-[300px] p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            {allDone ? <CheckCircle2 className="w-4 h-4 text-snap" /> : <Upload className="w-4 h-4 text-snap animate-pulse" />}
            <span className="font-bold text-sm">{allDone ? "Posted" : "Sharing your flick…"}</span>
            {allDone && onDismiss && <button onClick={onDismiss} className="ml-auto text-xs text-muted-foreground">Close</button>}
          </div>
          <div className="space-y-2">
            {stages.map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  {s.status === "done" ? <CheckCircle2 className="w-3 h-3 text-snap" /> :
                    s.status === "error" ? <AlertCircle className="w-3 h-3 text-destructive" /> :
                    <Loader2 className="w-3 h-3 animate-spin text-snap" />}
                  <span className={s.status === "error" ? "text-destructive" : ""}>{s.label}</span>
                  {s.detail && <span className="text-muted-foreground ml-auto">{s.detail}</span>}
                </div>
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className={`h-full ${s.status === "error" ? "bg-destructive" : "bg-snap"}`}
                    animate={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }}
                    transition={{ ease: "easeOut", duration: 0.4 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}