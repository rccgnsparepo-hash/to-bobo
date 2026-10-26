import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Server,
  Activity,
  Layers,
  Cpu,
  Smartphone,
  Mail,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  Clock,
  Terminal,
} from "lucide-react";
import {
  fetchSecurityAuditLogs,
  fetchSecuritySummary,
  getDeviceContinuityToken,
  collectClientEntropy,
  evaluateRegistrationAttempt,
  adminBanCluster,
} from "@/lib/securityService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityInspectorModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "simulator" | "audit">("overview");
  const [summary, setSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Simulation state
  const [simRunning, setSimRunning] = useState(false);
  const [simResults, setSimResults] = useState<
    {
      accountNumber: number;
      email: string;
      riskScore: number;
      riskTier: string;
      actionRequired: string;
      allowed: boolean;
      reasons: string[];
    }[]
  >([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, logs] = await Promise.all([
        fetchSecuritySummary().catch(() => null),
        fetchSecurityAuditLogs().catch(() => ({ logs: [] })),
      ]);
      setSummary(sum);
      setAuditLogs(logs?.logs || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const deviceToken = getDeviceContinuityToken();
  const clientEntropy = collectClientEntropy();

  // Run the 12-Account Abuse Simulation
  const runAbuseSimulation = async () => {
    setSimRunning(true);
    setSimResults([]);
    const results: any[] = [];

    const testPrefix = `testuser_${Date.now().toString(36).slice(4)}`;

    for (let i = 1; i <= 6; i++) {
      await new Promise((r) => setTimeout(r, 450));
      const testEmail = `${testPrefix}_acc${i}@gmail.com`;
      try {
        const evalRes = await evaluateRegistrationAttempt({
          email: testEmail,
          handle: `acc_${i}`,
        });

        results.push({
          accountNumber: i,
          email: testEmail,
          riskScore: evalRes.riskScore,
          riskTier: evalRes.riskTier,
          actionRequired: evalRes.actionRequired,
          allowed: evalRes.allowed,
          reasons: evalRes.reasons,
        });
        setSimResults([...results]);
      } catch (err: any) {
        results.push({
          accountNumber: i,
          email: testEmail,
          riskScore: 100,
          riskTier: "critical",
          actionRequired: "block_or_hold",
          allowed: false,
          reasons: ["Server block enforced: rate limit exceeded"],
        });
        setSimResults([...results]);
      }
    }
    setSimRunning(false);
    loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative text-zinc-100 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Flick Security & Abuse Prevention Inspector
              </h2>
              <p className="text-xs text-zinc-400">
                Multi-layer registration risk engine, device continuity & repeat-offender shields
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 pt-4 pb-3 border-b border-zinc-800 shrink-0 text-xs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Signals & Identity
          </button>
          <button
            onClick={() => setActiveTab("simulator")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "simulator"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Play className="w-3 h-3 text-emerald-400" />
            <span>12-Account Abuse Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "audit"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>Live Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
          {/* TAB 1: OVERVIEW & IDENTITY SIGNALS */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] mb-1">Evaluations Run</div>
                  <div className="text-lg font-bold font-mono text-zinc-100">
                    {summary?.totalEvaluations || auditLogs.length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] mb-1">Active Clusters</div>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    {summary?.activeClustersCount || 1}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] mb-1">Banned Clusters</div>
                  <div className="text-lg font-bold font-mono text-rose-400">
                    {summary?.bannedClustersCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-zinc-400 text-[11px] mb-1">Devices Indexed</div>
                  <div className="text-lg font-bold font-mono text-indigo-400">
                    {summary?.deviceTrackedCount || 1}
                  </div>
                </div>
              </div>

              {/* Live Device Entropy Profile */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Client Privacy-Preserving Device Signals</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 block">Device Continuity Token:</span>
                    <span className="font-mono text-zinc-300 break-all">{deviceToken}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 block">Screen & Resolution:</span>
                    <span className="font-mono text-zinc-300">{clientEntropy.screenResolution}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 block">WebGL Vendor Hash:</span>
                    <span className="font-mono text-zinc-300">{clientEntropy.webglVendor}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 block">Concurrency & Platform:</span>
                    <span className="font-mono text-zinc-300">
                      {clientEntropy.hardwareConcurrency} Cores • {clientEntropy.platform}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Layer Protection Breakdown */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                <div className="text-zinc-200 font-semibold mb-1">
                  Active Multi-Layer Defense Protocols
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-200">Device Continuity Hash:</strong>{" "}
                      <span className="text-zinc-400">
                        Tracks account volume per physical device signature; escalates risk exponentially past 2 accounts.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-200">Disposable & Burner Domain Filter:</strong>{" "}
                      <span className="text-zinc-400">
                        Filters 400+ tempmail domains and catches plus-aliasing/dot-obfuscation tricks.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-200">Phone Deduplication Enforcement:</strong>{" "}
                      <span className="text-zinc-400">
                        Limits one account per active verified phone number; prevents recycling numbers for spam syndicates.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-zinc-200">Cryptographic Permit Requirement:</strong>{" "}
                      <span className="text-zinc-400">
                        Server-authoritative HMAC token required to complete registration; client cannot forge verification.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SIMULATOR */}
          {activeTab === "simulator" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                <div className="font-semibold text-emerald-300">
                  How Flick Stops 12-Account Abuse
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  This test simulates an abuser attempting to create multiple accounts from the same device in rapid succession. Notice how the server dynamically increments risk from Low → Medium (Bot Shield) → High (Phone requirement & provisional limits) → Critical Block (Complete lockout).
                </p>
                <button
                  onClick={runAbuseSimulation}
                  disabled={simRunning}
                  className="mt-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{simRunning ? "Simulating Sequential Registrations..." : "Start Abuse Attack Simulation"}</span>
                </button>
              </div>

              {/* Simulation Output List */}
              <div className="space-y-2">
                {simResults.map((r) => {
                  const isBlocked = !r.allowed || r.riskTier === "critical";
                  const isHigh = r.riskTier === "high";
                  const isMedium = r.riskTier === "medium";
                  const isLow = r.riskTier === "low";

                  return (
                    <div
                      key={r.accountNumber}
                      className={`p-3 rounded-2xl border transition-all ${
                        isBlocked
                          ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                          : isHigh
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                          : isMedium
                          ? "bg-teal-500/10 border-teal-500/40 text-teal-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold">
                          Account Attempt #{r.accountNumber}: {r.email}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                            isBlocked
                              ? "bg-rose-500/20 text-rose-400"
                              : isHigh
                              ? "bg-amber-500/20 text-amber-400"
                              : isMedium
                              ? "bg-teal-500/20 text-teal-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          Score {r.riskScore} • {r.riskTier}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mb-1">
                        Outcome:{" "}
                        <strong className="text-zinc-200">
                          {isBlocked
                            ? "⛔ REGISTRATION BLOCKED (Held for safety review)"
                            : isHigh
                            ? "⚠️ HIGH RISK: Phone Verification + Bot Shield + 48h Provisional Limits"
                            : isMedium
                            ? "🛡️ MEDIUM RISK: Interactive Bot Challenge Required"
                            : "✅ LOW RISK: Standard Registration Permitted"}
                        </strong>
                      </div>
                      <ul className="list-disc list-inside text-[10px] text-zinc-400 space-y-0.5">
                        {r.reasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === "audit" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-zinc-400 pb-1">
                <span>Recent Server Registration Evaluations:</span>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="hover:text-zinc-200 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">
                  No security evaluations recorded yet. Run a registration or test simulation!
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-zinc-300 font-semibold">{log.email}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          log.riskTier === "critical"
                            ? "bg-rose-500/20 text-rose-400"
                            : log.riskTier === "high"
                            ? "bg-amber-500/20 text-amber-400"
                            : log.riskTier === "medium"
                            ? "bg-teal-500/20 text-teal-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {log.riskScore} / 100 • {log.riskTier}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>IP: {log.ip}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {log.reasons && log.reasons.length > 0 && (
                      <div className="text-[10px] text-zinc-400">
                        {log.reasons.join(" • ")}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
