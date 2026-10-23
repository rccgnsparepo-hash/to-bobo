import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { playSound } from "@/lib/soundEngine";
import { trigger3DToast } from "@/components/ui/Auth3DToast";

export type VerificationStatus =
  | "not_verified"
  | "in_progress"
  | "submitted"
  | "info_required"
  | "approved"
  | "rejected"
  | "revoked";

export type VerificationCategory =
  | "Creator"
  | "Brand"
  | "Community Leader"
  | "Public Figure"
  | "Journalist"
  | "Developer";

export type ImpersonationRisk = "low" | "medium" | "high";

export interface VerificationDocument {
  id: string;
  type: "Government ID" | "Passport" | "Business Registration" | "Tax Certificate" | "Press Credential";
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
  retentionNotice: string;
  storageRef?: string;
}

export interface VerificationAuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: "SUBMITTED" | "INFO_REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED" | "BENEFITS_UPDATED";
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  note?: string;
}

export interface VerificationBenefits {
  emeraldTick: boolean;
  customBanner: boolean;
  creatorAnalytics: boolean;
  discoveryPriority: boolean;
  impersonationShield: boolean;
  prioritySupportPlanned: boolean;
  betaAccessPlanned: boolean;
}

export interface VerificationApplication {
  userId: string;
  category: VerificationCategory;
  legalName: string;
  knownAs: string;
  organizationName?: string;
  email?: string;
  links: string[];
  notes: string;
  status: VerificationStatus;
  impersonationRisk: ImpersonationRisk;
  documents: VerificationDocument[];
  submittedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewNotes?: string;
  reapplyAfter?: string; // Cooling-off period for rejected applications
  auditTrail: VerificationAuditEntry[];
  benefits: VerificationBenefits;
}

const VERIFIED_CACHE_KEY = "flick:verified_registry_v2";
const APPLICATION_KEY_PREFIX = "flick:verification_app_v2:";

// Authoritative in-memory registry of verified user IDs & details
const verifiedUserIds = new Set<string>();
const userApplicationCache = new Map<string, VerificationApplication>();
let registryInitialized = false;

// Default initial benefits payload
export const DEFAULT_VERIFICATION_BENEFITS: VerificationBenefits = {
  emeraldTick: true,
  customBanner: true,
  creatorAnalytics: true,
  discoveryPriority: true,
  impersonationShield: true,
  prioritySupportPlanned: true,
  betaAccessPlanned: true,
};

/**
 * Initialize verified user IDs from local storage cache.
 */
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(VERIFIED_CACHE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((id) => verifiedUserIds.add(id));
      }
    }
  } catch {}
}

/**
 * Synchronous check whether a given user is verified.
 */
export function isUserVerified(userId?: string | null): boolean {
  if (!userId) return false;
  return verifiedUserIds.has(userId);
}

/**
 * Get cached verification application metadata if present.
 */
export function getCachedVerificationApp(userId?: string | null): VerificationApplication | null {
  if (!userId) return null;
  return userApplicationCache.get(userId) || null;
}

/**
 * Updates local verified status and dispatches global event.
 */
export function markUserVerifiedLocal(userId: string, isVerified: boolean, app?: VerificationApplication): void {
  if (isVerified) {
    verifiedUserIds.add(userId);
  } else {
    verifiedUserIds.delete(userId);
  }
  if (app) {
    userApplicationCache.set(userId, app);
    try {
      localStorage.setItem(`${APPLICATION_KEY_PREFIX}${userId}`, JSON.stringify(app));
    } catch {}
  }
  try {
    localStorage.setItem(VERIFIED_CACHE_KEY, JSON.stringify(Array.from(verifiedUserIds)));
    window.dispatchEvent(
      new CustomEvent("flick:verification-updated", { detail: { userId, isVerified } })
    );
  } catch {}
}

/**
 * Loads the active verification registry from Supabase user_settings and subscribes to Realtime updates.
 */
export async function initializeVerificationRegistry(): Promise<void> {
  if (registryInitialized || typeof window === "undefined") return;
  registryInitialized = true;

  try {
    const { data } = await supabase
      .from("user_settings")
      .select("user_id, is_premium, theme");

    if (data) {
      data.forEach((row) => {
        const theme = (row.theme as Record<string, unknown>) || {};
        const app = theme.verification_application as VerificationApplication | undefined;
        if (row.is_premium) {
          verifiedUserIds.add(row.user_id);
        } else {
          verifiedUserIds.delete(row.user_id);
        }
        if (app) {
          userApplicationCache.set(row.user_id, app);
        }
      });
      localStorage.setItem(VERIFIED_CACHE_KEY, JSON.stringify(Array.from(verifiedUserIds)));
      window.dispatchEvent(new Event("flick:verification-registry-synced"));
    }

    // Subscribe to realtime changes on user_settings
    supabase
      .channel("verification-registry-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_settings" },
        (payload) => {
          const row = payload.new as { user_id: string; is_premium: boolean; theme: Record<string, unknown> } | null;
          if (row?.user_id) {
            const isV = Boolean(row.is_premium);
            const app = row.theme?.verification_application as VerificationApplication | undefined;
            markUserVerifiedLocal(row.user_id, isV, app);
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("[verification] registry init error:", err);
  }
}

// Auto-trigger registry initialization
if (typeof window !== "undefined") {
  setTimeout(() => {
    void initializeVerificationRegistry();
  }, 100);
}

/**
 * React hook to listen for verification changes across the app.
 */
export function useVerificationRegistry() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion((v) => v + 1);
    window.addEventListener("flick:verification-updated", handler);
    window.addEventListener("flick:verification-registry-synced", handler);
    return () => {
      window.removeEventListener("flick:verification-updated", handler);
      window.removeEventListener("flick:verification-registry-synced", handler);
    };
  }, []);

  return {
    isVerified: (uid?: string | null) => isUserVerified(uid),
    version,
  };
}

/**
 * Load authoritative verification status for a user from Supabase user_settings.
 */
export async function fetchUserVerificationStatus(
  userId: string
): Promise<{ isVerified: boolean; application: VerificationApplication | null }> {
  let isVerified = false;
  let application: VerificationApplication | null = null;

  try {
    const { data } = await supabase
      .from("user_settings")
      .select("is_premium, theme")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      isVerified = Boolean(data.is_premium);
      const themeObj = (data.theme as Record<string, unknown>) || {};
      if (themeObj.verification_application) {
        application = themeObj.verification_application as VerificationApplication;
      }
    }

    // Fallback to local storage if not synced
    if (!application && typeof window !== "undefined") {
      const storedApp = localStorage.getItem(`${APPLICATION_KEY_PREFIX}${userId}`);
      if (storedApp) {
        application = JSON.parse(storedApp);
      }
    }

    markUserVerifiedLocal(userId, isVerified, application || undefined);
  } catch (err) {
    console.warn("[verification] fetch error:", err);
  }

  return { isVerified, application };
}

/**
 * Submit or update a verification application.
 */
export async function submitVerificationApplication(
  app: Omit<VerificationApplication, "status" | "submittedAt" | "auditTrail" | "benefits"> & {
    documents?: VerificationDocument[];
  }
): Promise<VerificationApplication> {
  const auditEntry: VerificationAuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorId: app.userId,
    actorName: app.knownAs || "Applicant",
    action: "SUBMITTED",
    previousStatus: "not_verified",
    newStatus: "submitted",
    note: "Application submitted for authenticity review.",
  };

  const fullApp: VerificationApplication = {
    ...app,
    documents: app.documents || [],
    status: "submitted",
    submittedAt: new Date().toISOString(),
    auditTrail: [auditEntry],
    benefits: DEFAULT_VERIFICATION_BENEFITS,
  };

  try {
    // 1. Save in user_settings theme payload
    const { data: currentSettings } = await supabase
      .from("user_settings")
      .select("theme, is_premium")
      .eq("user_id", app.userId)
      .maybeSingle();

    const currentTheme = (currentSettings?.theme as Record<string, unknown>) || {};
    await supabase.from("user_settings").upsert(
      {
        user_id: app.userId,
        theme: {
          ...currentTheme,
          verification_application: fullApp,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    markUserVerifiedLocal(app.userId, Boolean(currentSettings?.is_premium), fullApp);

    trigger3DToast({
      type: "success",
      title: "Verification Application Submitted",
      description: "Our review team will inspect your credentials and authenticity evidence.",
    });
  } catch (err) {
    console.error("[verification] submission error:", err);
    throw err;
  }

  return fullApp;
}

/**
 * Administrative action: Approve verification application.
 * Grants green badge server-side and logs auditable decision.
 */
export async function approveVerification(
  targetUserId: string,
  reviewerId: string,
  reviewerName: string,
  reviewNotes: string = "Verified authenticity and credentials confirmed."
): Promise<void> {
  try {
    const { data: currentSettings } = await supabase
      .from("user_settings")
      .select("theme")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const currentTheme = (currentSettings?.theme as Record<string, unknown>) || {};
    const existingApp = (currentTheme.verification_application as VerificationApplication) || {
      userId: targetUserId,
      category: "Creator",
      legalName: "Verified Creator",
      knownAs: "Flick Creator",
      links: [],
      notes: "",
      impersonationRisk: "low",
      documents: [],
      status: "submitted",
      submittedAt: new Date().toISOString(),
      auditTrail: [],
      benefits: DEFAULT_VERIFICATION_BENEFITS,
    };

    const auditEntry: VerificationAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorId: reviewerId,
      actorName: reviewerName,
      action: "APPROVED",
      previousStatus: existingApp.status || "submitted",
      newStatus: "approved",
      note: reviewNotes,
    };

    const updatedApp: VerificationApplication = {
      ...existingApp,
      status: "approved",
      reviewedAt: new Date().toISOString(),
      reviewerId,
      reviewerName,
      reviewNotes,
      auditTrail: [auditEntry, ...(existingApp.auditTrail || [])],
      benefits: existingApp.benefits || DEFAULT_VERIFICATION_BENEFITS,
    };

    // Update user_settings
    await supabase.from("user_settings").upsert(
      {
        user_id: targetUserId,
        is_premium: true,
        premium_since: new Date().toISOString(),
        theme: {
          ...currentTheme,
          verification_application: updatedApp,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    markUserVerifiedLocal(targetUserId, true, updatedApp);

    // Play triumphant chime
    try {
      playSound("verification_badge");
    } catch {}

    void notify({
      kind: "system",
      title: "Flick Verification Approved ✦",
      message: "Congratulations! Your account has received the official Green Verification Tick.",
      actor: { id: reviewerId, display_name: reviewerName, handle: "flick" },
      recipients: [targetUserId],
      url: "/profile",
      dedupe_id: `verify-approved-${targetUserId}`,
    });

    trigger3DToast({
      type: "success",
      title: "Account Verified! ✦",
      description: "The emerald green verification tick is now permanently active on this account.",
    });
  } catch (err) {
    console.error("[verification] approval error:", err);
    throw err;
  }
}

/**
 * Administrative action: Request additional information from applicant.
 */
export async function requestAdditionalInfo(
  targetUserId: string,
  reviewerId: string,
  reviewerName: string,
  feedbackNotes: string
): Promise<void> {
  try {
    const { data: currentSettings } = await supabase
      .from("user_settings")
      .select("theme")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const currentTheme = (currentSettings?.theme as Record<string, unknown>) || {};
    const existingApp = (currentTheme.verification_application as VerificationApplication) || {
      userId: targetUserId,
      category: "Creator",
      legalName: "Applicant",
      knownAs: "User",
      links: [],
      notes: "",
      impersonationRisk: "medium",
      documents: [],
      status: "submitted",
      submittedAt: new Date().toISOString(),
      auditTrail: [],
      benefits: DEFAULT_VERIFICATION_BENEFITS,
    };

    const auditEntry: VerificationAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorId: reviewerId,
      actorName: reviewerName,
      action: "INFO_REQUESTED",
      previousStatus: existingApp.status || "submitted",
      newStatus: "info_required",
      note: feedbackNotes,
    };

    const updatedApp: VerificationApplication = {
      ...existingApp,
      status: "info_required",
      reviewedAt: new Date().toISOString(),
      reviewerId,
      reviewerName,
      reviewNotes: feedbackNotes,
      auditTrail: [auditEntry, ...(existingApp.auditTrail || [])],
    };

    await supabase.from("user_settings").upsert(
      {
        user_id: targetUserId,
        is_premium: false,
        theme: {
          ...currentTheme,
          verification_application: updatedApp,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    markUserVerifiedLocal(targetUserId, false, updatedApp);

    void notify({
      kind: "system",
      title: "Action Required on Verification",
      message: `Additional evidence required: ${feedbackNotes}`,
      actor: { id: reviewerId, display_name: reviewerName, handle: "flick" },
      recipients: [targetUserId],
      url: "/verification",
      dedupe_id: `verify-info-${targetUserId}`,
    });

    trigger3DToast({
      type: "info",
      title: "Information Requested",
      description: "Applicant has been prompted to provide additional evidence.",
    });
  } catch (err) {
    console.error("[verification] request info error:", err);
    throw err;
  }
}

/**
 * Administrative action: Reject verification with policy reason and cooling-off reapplication date.
 */
export async function rejectVerification(
  targetUserId: string,
  reviewerId: string,
  reviewerName: string,
  reason: string
): Promise<void> {
  try {
    const { data: currentSettings } = await supabase
      .from("user_settings")
      .select("theme")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const currentTheme = (currentSettings?.theme as Record<string, unknown>) || {};
    const existingApp = (currentTheme.verification_application as VerificationApplication) || {
      userId: targetUserId,
      category: "Creator",
      legalName: "User",
      knownAs: "",
      links: [],
      notes: "",
      impersonationRisk: "low",
      documents: [],
      status: "submitted",
      submittedAt: new Date().toISOString(),
      auditTrail: [],
      benefits: DEFAULT_VERIFICATION_BENEFITS,
    };

    // 30 days reapplication cooling-off guidance
    const reapplyDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const auditEntry: VerificationAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorId: reviewerId,
      actorName: reviewerName,
      action: "REJECTED",
      previousStatus: existingApp.status || "submitted",
      newStatus: "rejected",
      note: reason,
    };

    const updatedApp: VerificationApplication = {
      ...existingApp,
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      reviewerId,
      reviewerName,
      reviewNotes: reason,
      reapplyAfter: reapplyDate,
      auditTrail: [auditEntry, ...(existingApp.auditTrail || [])],
    };

    await supabase.from("user_settings").upsert(
      {
        user_id: targetUserId,
        is_premium: false,
        theme: {
          ...currentTheme,
          verification_application: updatedApp,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    markUserVerifiedLocal(targetUserId, false, updatedApp);

    void notify({
      kind: "system",
      title: "Verification Review Decision",
      message: `Your verification request was not approved: ${reason}`,
      actor: { id: reviewerId, display_name: reviewerName, handle: "flick" },
      recipients: [targetUserId],
      url: "/verification",
      dedupe_id: `verify-rejected-${targetUserId}`,
    });

    trigger3DToast({
      type: "info",
      title: "Application Rejected",
      description: "Feedback recorded with guidance for future reapplication.",
    });
  } catch (err) {
    console.error("[verification] rejection error:", err);
    throw err;
  }
}

/**
 * Administrative action: Revoke verification under platform policy.
 */
export async function revokeVerification(
  targetUserId: string,
  reviewerId: string,
  reviewerName: string,
  policyReason: string
): Promise<void> {
  try {
    const { data: currentSettings } = await supabase
      .from("user_settings")
      .select("theme")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const currentTheme = (currentSettings?.theme as Record<string, unknown>) || {};
    const existingApp = (currentTheme.verification_application as VerificationApplication) || {
      userId: targetUserId,
      category: "Creator",
      legalName: "User",
      knownAs: "",
      links: [],
      notes: "",
      impersonationRisk: "high",
      documents: [],
      status: "approved",
      submittedAt: new Date().toISOString(),
      auditTrail: [],
      benefits: DEFAULT_VERIFICATION_BENEFITS,
    };

    const auditEntry: VerificationAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorId: reviewerId,
      actorName: reviewerName,
      action: "REVOKED",
      previousStatus: "approved",
      newStatus: "revoked",
      note: policyReason,
    };

    const updatedApp: VerificationApplication = {
      ...existingApp,
      status: "revoked",
      reviewedAt: new Date().toISOString(),
      reviewerId,
      reviewerName,
      reviewNotes: policyReason,
      auditTrail: [auditEntry, ...(existingApp.auditTrail || [])],
    };

    await supabase.from("user_settings").upsert(
      {
        user_id: targetUserId,
        is_premium: false,
        theme: {
          ...currentTheme,
          verification_application: updatedApp,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    markUserVerifiedLocal(targetUserId, false, updatedApp);

    void notify({
      kind: "system",
      title: "Verification Revoked",
      message: `Your verified badge has been revoked under platform policy: ${policyReason}`,
      actor: { id: reviewerId, display_name: reviewerName, handle: "flick" },
      recipients: [targetUserId],
      url: "/verification",
      dedupe_id: `verify-revoked-${targetUserId}`,
    });

    trigger3DToast({
      type: "warning",
      title: "Verification Revoked",
      description: "The emerald badge has been removed and user notified.",
    });
  } catch (err) {
    console.error("[verification] revoke error:", err);
    throw err;
  }
}
