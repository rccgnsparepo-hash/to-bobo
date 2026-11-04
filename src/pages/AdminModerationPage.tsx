import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserX,
  Trash2,
  RefreshCw,
  Filter,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getModerationQueue,
  resolveModerationReport,
  type ModerationReport,
} from "@/lib/safety/safetyService";

export default function AdminModerationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await getModerationQueue();
      setReports(data);
    } catch {
      toast.error("Failed to load moderation tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleAction = async (
    reportId: string,
    action: "dismissed" | "content_removed" | "user_warned" | "user_suspended"
  ) => {
    if (!user) return;
    setActingId(reportId);
    try {
      await resolveModerationReport(reportId, action, user.id);
      toast.success(`Action applied: ${action.replace("_", " ")}`);
      await loadQueue();
    } catch {
      toast.error("Failed to apply moderation action");
    } finally {
      setActingId(null);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filter === "open") return r.status === "open" || r.status === "reviewing";
    if (filter === "resolved") return r.status === "resolved" || r.status === "dismissed";
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto min-h-screen pb-32 px-4 sm:px-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/80 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Safety & Moderation Queue</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Review reported content, abuse tickets, and user appeals
            </p>
          </div>
        </div>

        <button
          onClick={loadQueue}
          aria-label="Refresh queue"
          className="p-2 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pt-4 pb-3">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition ${
              filter === f
                ? "bg-snap text-snap-foreground shadow-sm shadow-snap/20"
                : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            {f} {f === "open" && `(${reports.filter((r) => r.status === "open").length})`}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-snap" />
            <span className="text-xs">Loading queue…</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-snap mx-auto" />
            <h3 className="font-bold text-foreground text-sm">Queue is all clear</h3>
            <p className="text-xs text-muted-foreground">No reports pending review.</p>
          </div>
        ) : (
          filteredReports.map((r) => {
            const isActing = actingId === r.id;
            return (
              <div
                key={r.id}
                className="p-5 rounded-3xl bg-card border border-border/80 space-y-3 shadow-sm hover:border-snap/40 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        {r.reason}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        {r.target_type}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-1">
                      Target ID: <span className="text-foreground">{r.target_id}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      r.status === "resolved"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                {r.note && (
                  <div className="p-3 rounded-2xl bg-secondary/50 border border-border/60 text-xs text-foreground/90">
                    <span className="text-muted-foreground font-semibold">Reporter note:</span> "{r.note}"
                  </div>
                )}

                {r.status === "open" ? (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                    <button
                      disabled={isActing}
                      onClick={() => handleAction(r.id, "dismissed")}
                      className="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                    <button
                      disabled={isActing}
                      onClick={() => handleAction(r.id, "content_removed")}
                      className="px-3 py-1.5 rounded-full bg-destructive/15 hover:bg-destructive/25 text-destructive text-xs font-semibold border border-destructive/30 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Content</span>
                    </button>
                    <button
                      disabled={isActing}
                      onClick={() => handleAction(r.id, "user_warned")}
                      className="px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Warn User</span>
                    </button>
                    <button
                      disabled={isActing}
                      onClick={() => handleAction(r.id, "user_suspended")}
                      className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Suspend</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-snap" />
                    <span>
                      Resolved as <b>{r.resolution_action?.replace("_", " ")}</b> on{" "}
                      {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString() : "recently"}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
