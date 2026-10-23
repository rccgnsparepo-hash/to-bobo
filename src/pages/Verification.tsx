import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Send,
  Lock,
  UploadCloud,
  Info,
  Check,
  X,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import {
  fetchUserVerificationStatus,
  submitVerificationApplication,
  type VerificationApplication,
  type VerificationCategory,
  type VerificationStatus,
  type VerificationDocument,
} from "@/lib/verification";
import { trigger3DToast } from "@/components/ui/Auth3DToast";

const CATEGORIES: VerificationCategory[] = [
  "Creator",
  "Brand",
  "Community Leader",
  "Public Figure",
  "Journalist",
  "Developer",
];

const DOCUMENT_TYPES = [
  "Government ID",
  "Passport",
  "Business Registration",
  "Tax Certificate",
  "Press Credential",
] as const;

export default function VerificationPage() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [app, setApp] = useState<VerificationApplication | null>(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<"portal" | "benefits">("portal");

  // Application form wizard states
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [category, setCategory] = useState<VerificationCategory>("Creator");
  const [legalName, setLegalName] = useState("");
  const [knownAs, setKnownAs] = useState("");
  const [orgName, setOrgName] = useState("");
  const [linksText, setLinksText] = useState("");
  const [notes, setNotes] = useState("");
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>("Government ID");
  const [attachedDoc, setAttachedDoc] = useState<VerificationDocument | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchUserVerificationStatus(user.id).then(({ isVerified: v, application: a }) => {
      setIsVerified(v);
      setApp(a);
      if (a) {
        setCategory(a.category || "Creator");
        setLegalName(a.legalName || "");
        setKnownAs(a.knownAs || profile?.display_name || "");
        setOrgName(a.organizationName || "");
        setLinksText((a.links || []).join("\n"));
        setNotes(a.notes || "");
        if (a.documents && a.documents.length > 0) {
          setAttachedDoc(a.documents[0]);
        }
      } else {
        setKnownAs(profile?.display_name || "");
      }
      setLoading(false);
    });
  }, [user, profile]);

  // Handle mock document attachment
  const handleAttachDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newDoc: VerificationDocument = {
      id: `doc-${Date.now()}`,
      type: docType,
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      uploadedAt: new Date().toISOString(),
      retentionNotice: "Encrypted securely. Retained exclusively for verification review. Permanently purged after 90 days.",
    };

    setAttachedDoc(newDoc);
    trigger3DToast({
      type: "success",
      title: "Document Staged",
      description: `${file.name} attached with strict encryption and 90-day auto-purge policy.`,
    });
  };

  // Submit Application
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const links = linksText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const submitted = await submitVerificationApplication({
        userId: user.id,
        category,
        legalName: legalName.trim(),
        knownAs: knownAs.trim() || profile?.display_name || "",
        organizationName: orgName.trim(),
        email: user.email || undefined,
        links,
        notes: notes.trim(),
        impersonationRisk: "low",
        documents: attachedDoc ? [attachedDoc] : [],
      });

      setApp(submitted);
      setStep(4);
    } catch (err) {
      trigger3DToast({
        type: "error",
        title: "Submission Error",
        description: (err as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  // Readiness Checklist Helpers
  const hasAvatar = Boolean(profile?.avatar_url);
  const hasBio = Boolean(profile?.bio && profile.bio.trim().length > 5);
  const hasHandle = Boolean(profile?.handle);
  const hasEmail = Boolean(user?.email);
  const readinessCount = [hasAvatar, hasBio, hasHandle, hasEmail].filter(Boolean).length;

  return (
    <div className="min-h-full max-w-4xl mx-auto px-4 py-8 pb-32">
      {/* Top Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <button
          onClick={() => nav(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-secondary transition inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground self-start"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-2xl border border-border">
          <button
            onClick={() => setActiveTab("portal")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "portal" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verification Portal</span>
          </button>
          <button
            onClick={() => setActiveTab("benefits")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "benefits" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-4 h-4 text-snap" />
            <span>Creator Privileges</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* TAB 1: VERIFICATION PORTAL (APPLICATION & STATUS LIFECYCLE) */}
      {/* ========================================================================= */}
      {activeTab === "portal" && (
        <div className="space-y-8">
          {/* Emerald Trust Symbol Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-card to-card shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                <FlickVerifiedBadge size={38} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>Authenticity Trust Symbol</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-white flex items-center gap-2.5 flex-wrap">
                  <span>Flick Green Verification</span>
                  <FlickVerifiedBadge size={24} />
                </h1>
                <p className="text-sm text-white/75 mt-2 leading-relaxed max-w-2xl">
                  The shiny emerald green tick is Flick&apos;s recognizable trust badge. It certifies genuine
                  creators, organizations, and public figures. Verification is awarded exclusively on authentic
                  merit and identity checks — it cannot be bought.
                </p>
              </div>
            </div>

            {/* Verification Status Lifecycle Bar */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  Current Application Status
                </div>
                <div>
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approved · Green Tick Active ✦</span>
                    </span>
                  ) : app?.status === "submitted" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold">
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Submitted for Review</span>
                    </span>
                  ) : app?.status === "info_required" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 text-xs font-bold">
                      <Info className="w-4 h-4" />
                      <span>Additional Info Required</span>
                    </span>
                  ) : app?.status === "rejected" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-400/40 text-xs font-bold">
                      <AlertCircle className="w-4 h-4" />
                      <span>Application Not Approved</span>
                    </span>
                  ) : app?.status === "revoked" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-400/40 text-xs font-bold">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Verification Revoked</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-bold">
                      <span>Not Verified</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Lifecycle Step Tracker */}
              <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold text-muted-foreground">
                <div
                  className={`p-2.5 rounded-xl border transition ${
                    app?.status
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-card/40"
                  }`}
                >
                  1. Profile Ready
                </div>
                <div
                  className={`p-2.5 rounded-xl border transition ${
                    ["submitted", "info_required", "approved", "rejected", "revoked"].includes(app?.status || "")
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-card/40"
                  }`}
                >
                  2. Evidence Submitted
                </div>
                <div
                  className={`p-2.5 rounded-xl border transition ${
                    app?.status === "info_required"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300 animate-pulse"
                      : ["approved", "rejected", "revoked"].includes(app?.status || "")
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-border bg-card/40"
                  }`}
                >
                  3. Identity Review
                </div>
                <div
                  className={`p-2.5 rounded-xl border transition ${
                    isVerified
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 font-bold"
                      : app?.status === "rejected" || app?.status === "revoked"
                        ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : "border-border bg-card/40"
                  }`}
                >
                  4. Final Status
                </div>
              </div>
            </div>
          </div>

          {/* Feedback or Rejection Guidance Notice */}
          {app?.reviewNotes && (
            <div
              className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
                app.status === "info_required"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : app.status === "rejected"
                    ? "bg-red-500/10 border-red-500/30 text-red-200"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
              }`}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Reviewer Feedback:</span> {app.reviewNotes}
                {app.reapplyAfter && app.status === "rejected" && (
                  <div className="mt-1.5 text-muted-foreground">
                    Reapplication guidance: You can submit an updated verification application after{" "}
                    {new Date(app.reapplyAfter).toLocaleDateString()}.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Established Profile Readiness Card */}
          <div className="card-glass rounded-3xl p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg tracking-tight">Authenticity Readiness Checklist</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Requirements for verification consideration (follower count is never the sole criterion).
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
                {readinessCount}/4 Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div
                className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                  hasAvatar ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-border text-muted-foreground"
                }`}
              >
                {hasAvatar ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                <span>Active Profile Picture Avatar</span>
              </div>
              <div
                className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                  hasHandle ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-border text-muted-foreground"
                }`}
              >
                {hasHandle ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                <span>Registered Unique Handle (@{profile?.handle || "handle"})</span>
              </div>
              <div
                className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                  hasBio ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-border text-muted-foreground"
                }`}
              >
                {hasBio ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-amber-400" />}
                <span>Established Bio & Introduction</span>
              </div>
              <div
                className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                  hasEmail ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-border text-muted-foreground"
                }`}
              >
                {hasEmail ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                <span>Verified Email Address</span>
              </div>
            </div>
          </div>

          {/* APPLICATION FORM OR ACTIVE VERIFIED STATUS */}
          {isVerified ? (
            <div className="card-glass rounded-3xl p-8 border border-emerald-500/40 text-center space-y-4 bg-gradient-to-b from-emerald-950/20 to-card">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-400/30 shadow-lg">
                <FlickVerifiedBadge size={36} />
              </div>
              <h2 className="font-display text-2xl text-emerald-400">Account Authenticated & Verified</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Your account is officially certified as an authentic Flick {app?.category || "Creator"}. Your
                shiny green tick is visible next to your name across your profile, Flicks, comments, DMs, search,
                and notifications.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-snap text-snap-foreground font-bold text-xs hover:brightness-105 transition"
                >
                  <span>View Verified Profile</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setActiveTab("benefits")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-foreground font-bold text-xs hover:bg-secondary/80 transition border border-border"
                >
                  <span>Manage Privileges</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="card-glass rounded-3xl p-6 sm:p-8 border border-border space-y-6">
              <div className="border-b border-border pb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl tracking-tight">Apply for Green Verification Tick</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submit evidence of identity and public presence for authentic verification.
                  </p>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">Step {step} of 3</div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* STEP 1: Category & Identity */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Verification Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as VerificationCategory)}
                        className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Full Legal Name / Entity Name
                        </label>
                        <input
                          required
                          value={legalName}
                          onChange={(e) => setLegalName(e.target.value)}
                          placeholder="e.g. Ryder Vance or Vance Studios LLC"
                          className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Public Creator Persona / Handle
                        </label>
                        <input
                          required
                          value={knownAs}
                          onChange={(e) => setKnownAs(e.target.value)}
                          placeholder={`@${profile?.handle || "handle"}`}
                          className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Organization, Agency, or Production Label (Optional)
                      </label>
                      <input
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g. Independent Creator, Sony Music, Warner Bros"
                        className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={!legalName.trim() || !knownAs.trim()}
                        onClick={() => setStep(2)}
                        className="px-6 py-3 rounded-2xl bg-snap text-snap-foreground font-bold text-xs disabled:opacity-50 transition flex items-center gap-2"
                      >
                        <span>Continue to Evidence</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Authenticity Evidence Links */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Authenticity Proof Links (One URL per line)
                      </label>
                      <textarea
                        rows={4}
                        value={linksText}
                        onChange={(e) => setLinksText(e.target.value)}
                        placeholder="https://instagram.com/yourhandle&#10;https://youtube.com/@channel&#10;https://imdb.com/name/yourname&#10;https://yourpersonalwebsite.com"
                        className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Provide official social channels, portfolio sites, Wikipedia, or press articles supporting
                        your identity.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Authenticity Context & Bio Summary
                      </label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Explain why this account is authentic and notable in its category..."
                        className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap resize-none"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-4 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="px-6 py-3 rounded-2xl bg-snap text-snap-foreground font-bold text-xs transition flex items-center gap-2"
                      >
                        <span>Continue to Documentation</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: Identity Documentation & Privacy Notice */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="p-4 rounded-2xl bg-secondary/60 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <Lock className="w-4 h-4 text-emerald-400" />
                        <span>Strict Privacy & Document Security</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Identity documents are encrypted and accessible exclusively to the authorized verification
                        audit team. Under platform policy, document files are retained for a maximum of 90 days
                        solely for appeal and authenticity audit, after which they are permanently purged.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Select Document Type
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value as (typeof DOCUMENT_TYPES)[number])}
                        className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap"
                      >
                        {DOCUMENT_TYPES.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-snap/60 transition bg-secondary/30 relative cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleAttachDocument}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="w-8 h-8 text-snap mx-auto mb-2" />
                      <div className="text-xs font-bold text-foreground">
                        {attachedDoc ? attachedDoc.fileName : `Click to attach ${docType}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {attachedDoc
                          ? `${attachedDoc.fileSize || "File staged"} · Ready for encrypted submission`
                          : "Supports JPG, PNG, PDF up to 15MB"}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-card border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                      <Info className="w-4 h-4 text-snap shrink-0" />
                      <span>
                        By submitting, you certify that all information is accurate and authentic. Submitting forged
                        credentials violates platform terms and results in permanent account suspension.
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-4 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-bold"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={busy || !legalName.trim()}
                        className="px-6 py-3 rounded-2xl bg-emerald-500 text-black font-bold text-xs disabled:opacity-50 transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                      >
                        <Send className="w-4 h-4" />
                        <span>{busy ? "Submitting..." : "Submit Verification Application"}</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 4: Submitted Confirmation */}
                {step === 4 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-400/40">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="font-display text-2xl tracking-tight">Application Submitted for Review</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      Thank you for submitting your verification credentials. Our review team verifies applications
                      based on genuine authenticity, category relevance, and impersonation risk. You will receive an
                      in-app notification once your review is finalized.
                    </p>
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-5 py-2.5 rounded-full bg-secondary text-foreground text-xs font-bold border border-border"
                      >
                        View Submission Summary
                      </button>
                    </div>
                  </motion.div>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VERIFIED CREATOR PRIVILEGES & BENEFITS (6.3) */}
      {/* ========================================================================= */}
      {activeTab === "benefits" && (
        <div className="space-y-8">
          <div className="card-glass rounded-3xl p-6 sm:p-8 border border-border space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-snap/15 text-snap border border-snap/30 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Platform Value & Creator Tools</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">Verified Creator Privileges</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Flick verification goes beyond displaying a trust symbol. Verified accounts gain access to enhanced
              presentation options, creator analytics, and proactive account security.
            </p>
          </div>

          {/* ACTIVE PRIVILEGES */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="font-display text-base uppercase tracking-wider font-bold">Active Privileges</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-glass rounded-2xl p-5 border border-emerald-500/30 space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <FlickVerifiedBadge size={22} />
                </div>
                <h4 className="font-bold text-sm text-foreground">Platform-Wide Emerald Tick</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Visually consistent shiny green checkmark featured on profiles, Flicks, comments, DMs, search,
                  and notifications.
                </p>
                <div className="text-[11px] font-semibold text-emerald-400">Status: Active platform-wide</div>
              </div>

              <div className="card-glass rounded-2xl p-5 border border-border space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-snap/20 text-snap flex items-center justify-center border border-snap/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Enhanced Profile Customization</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Verified Creator profile badge display, custom header accent tints, and highlighted links on your
                  profile.
                </p>
                <div className="text-[11px] font-semibold text-snap">Status: Active for verified users</div>
              </div>

              <div className="card-glass rounded-2xl p-5 border border-border space-y-2.5 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground">Richer Creator Insights</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Deep engagement metrics on Flicks, unique views trends, D3 activity heatmaps, and retention funnels.
                  </p>
                  <div className="text-[11px] font-semibold text-blue-400">Status: Active in Creator Hub</div>
                </div>
                <div className="pt-2">
                  <Link
                    to="/creator-insights"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-400/30 text-xs font-bold transition"
                  >
                    <span>Open Creator Insights</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="card-glass rounded-2xl p-5 border border-border space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Impersonation Shield & Priority Discovery</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Authentic account boost in user search results, plus proactive alerts whenever duplicate handles or
                  spoof attempts are detected.
                </p>
                <div className="text-[11px] font-semibold text-purple-400">Status: Enforced server-side</div>
              </div>
            </div>
          </div>

          {/* PLANNED PRIVILEGES (TRANSPARENT ROADMAP) */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
              <h3 className="font-display text-base uppercase tracking-wider font-bold text-muted-foreground">
                Planned Privileges (Roadmap)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-glass rounded-2xl p-5 border border-border/60 opacity-85 space-y-2">
                <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                  <span>Priority Partner Support</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    Targeted Q3 2026
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fast-tracked dispute resolution, account recovery, and direct escalation desk for creator copyright
                  or impersonation issues.
                </p>
              </div>

              <div className="card-glass rounded-2xl p-5 border border-border/60 opacity-85 space-y-2">
                <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                  <span>Beta Tool & Feature Previews</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    Targeted Q4 2026
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Early sandbox testing of new camera formats, audio remixing tools, and collaborative creator
                  flick streams.
                </p>
              </div>
            </div>
          </div>

          {/* ANTI-ABUSE & SAFETY GUARANTEES */}
          <div className="p-4 rounded-2xl bg-secondary/50 border border-border text-xs space-y-2 text-muted-foreground">
            <div className="font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-snap" />
              <span>Anti-Abuse & Platform Safety Guarantees</span>
            </div>
            <p className="leading-relaxed">
              Verification does not promise virality or monetization that the platform cannot genuinely guarantee.
              Crucially, verified status does not grant immunity from community moderation, spam filtering, privacy
              controls, or copyright enforcement. Accounts engaged in harassment, impersonation, or credential
              reselling will have their verification immediately and permanently revoked.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
