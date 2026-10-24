import { useState, useRef, MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTenant } from "@/lib/tenantContext";
import {
  Building2,
  Check,
  Plus,
  Users,
  Copy,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Globe,
  Layers,
} from "lucide-react";

export function WorkspaceSwitcherModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { currentTenant, tenants, switchTenant, createTenant, joinTenant } = useTenant();
  const [tab, setTab] = useState<"switch" | "create" | "join">("switch");

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accentColor, setAccentColor] = useState("#c5e863");
  const [busy, setBusy] = useState(false);

  // Join form state
  const [inviteCode, setInviteCode] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 3D Tilt effect state for hovered card
  const [tilt, setTilt] = useState<{ id: string; x: number; y: number } | null>(null);

  const handleCardMouseMove = (e: MouseEvent<HTMLDivElement>, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -16;
    setTilt({ id, x, y });
  };

  const handleCardMouseLeave = () => {
    setTilt(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createTenant({ name, description, accent_color: accentColor });
      setName("");
      setDescription("");
      setTab("switch");
      onClose();
    } catch {
      // toast shown in context
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || busy) return;
    setBusy(true);
    try {
      await joinTenant(inviteCode);
      setInviteCode("");
      setTab("switch");
      onClose();
    } catch {
      // toast shown in context
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="w-full max-w-xl bg-[#0c0d12]/95 border border-white/15 rounded-3xl p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden relative backdrop-blur-2xl"
          >
            {/* Ambient Background Glow */}
            <div
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-[100px] pointer-events-none opacity-40"
              style={{ background: currentTenant.accent_color }}
            />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md border border-white/20"
                  style={{
                    backgroundColor: `${currentTenant.accent_color}25`,
                    color: currentTenant.accent_color,
                  }}
                >
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    Workspaces & Tenants
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                      Multi-tenant
                    </span>
                  </h3>
                  <p className="text-xs text-white/60">
                    Switch context, isolate data, or create a new team workspace
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-nav Tabs */}
            <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl mt-4 relative z-10">
              <button
                type="button"
                onClick={() => setTab("switch")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  tab === "switch"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Workspaces ({tenants.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("create")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  tab === "create"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("join")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  tab === "join"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Join with Code</span>
              </button>
            </div>

            {/* TAB 1: WORKSPACES LIST WITH 3D TILT CARDS */}
            {tab === "switch" && (
              <div className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1 no-scrollbar relative z-10">
                {tenants.map((t) => {
                  const isActive = t.id === currentTenant.id;
                  const isHovered = tilt?.id === t.id;

                  return (
                    <motion.div
                      key={t.id}
                      onMouseMove={(e) => handleCardMouseMove(e, t.id)}
                      onMouseLeave={handleCardMouseLeave}
                      onClick={() => {
                        switchTenant(t.id);
                        onClose();
                      }}
                      style={{
                        perspective: 800,
                        transform: isHovered
                          ? `rotateX(${tilt?.y || 0}deg) rotateY(${tilt?.x || 0}deg) scale(1.01)`
                          : "rotateX(0deg) rotateY(0deg) scale(1)",
                        transition: isHovered
                          ? "transform 0.08s ease-out"
                          : "transform 0.35s ease-in-out",
                      }}
                      className={`relative p-4 rounded-2xl border transition-colors cursor-pointer group backdrop-blur-md overflow-hidden ${
                        isActive
                          ? "bg-white/10 border-white/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                          : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      {/* Specular glare */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.05] to-white/0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />

                      <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="flex items-start gap-3.5">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg border shadow-inner shrink-0"
                            style={{
                              borderColor: `${t.accent_color}50`,
                              backgroundColor: `${t.accent_color}20`,
                              color: t.accent_color,
                            }}
                          >
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-white">{t.name}</h4>
                              {isActive && (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-black flex items-center gap-1 shadow-sm"
                                  style={{ backgroundColor: t.accent_color }}
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  Active
                                </span>
                              )}
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                                {t.tier}
                              </span>
                            </div>
                            <p className="text-xs text-white/70 mt-1 line-clamp-1">{t.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-white/50">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {t.member_count.toLocaleString()} members
                              </span>
                              <span>·</span>
                              <span className="font-mono">#{t.slug}</span>
                            </div>
                          </div>
                        </div>

                        {/* Copy invite code */}
                        {t.invite_code && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInvite(t.invite_code!, t.id);
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center gap-1.5 transition shrink-0"
                            title="Copy workspace invite code"
                          >
                            {copiedId === t.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Invite</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: CREATE WORKSPACE */}
            {tab === "create" && (
              <form onSubmit={handleCreate} className="mt-4 space-y-4 relative z-10">
                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Creative Agency"
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1.5">
                    Description / Purpose
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Production hub for daily releases"
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1.5">
                    Workspace Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    {["#c5e863", "#a855f7", "#38bdf8", "#ec4899", "#f59e0b", "#10b981"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAccentColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition ${
                          accentColor === c ? "scale-110 border-white shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("switch")}
                    className="py-3 px-5 rounded-2xl bg-white/10 text-white/80 text-xs font-bold hover:bg-white/15 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="flex-1 py-3 rounded-2xl bg-snap text-snap-foreground text-xs font-bold flex items-center justify-center gap-2 hover:brightness-105 transition disabled:opacity-50 shadow-lg shadow-snap/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Create & Switch to Workspace</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: JOIN WITH INVITE CODE */}
            {tab === "join" && (
              <form onSubmit={handleJoin} className="mt-4 space-y-4 relative z-10">
                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1.5">
                    Workspace Invite Code or Slug
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="e.g. FLICK-GLOBAL or INV-9X28"
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white uppercase placeholder:text-white/40 text-sm focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap transition font-mono"
                  />
                  <p className="text-[11px] text-white/50 mt-1">
                    Ask an existing workspace member for their invite code to join.
                  </p>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("switch")}
                    className="py-3 px-5 rounded-2xl bg-white/10 text-white/80 text-xs font-bold hover:bg-white/15 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !inviteCode.trim()}
                    className="flex-1 py-3 rounded-2xl bg-snap text-snap-foreground text-xs font-bold flex items-center justify-center gap-2 hover:brightness-105 transition disabled:opacity-50 shadow-lg shadow-snap/20"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Join Workspace</span>
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
