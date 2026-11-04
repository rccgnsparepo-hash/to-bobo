import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "self_harm"
  | "nudity"
  | "impersonation"
  | "other";

export type ReportTargetType = "post" | "profile" | "story" | "message";

export type ModerationReport = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  note: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolution_action: "dismissed" | "content_removed" | "user_warned" | "user_suspended" | null;
  resolved_at: string | null;
  created_at: string;
};

// Rate limiter storage (in-memory + localStorage backup)
const RATE_LIMIT_WINDOWS = {
  reports: { max: 5, windowMs: 60 * 1000 }, // 5 reports / min
  follows: { max: 20, windowMs: 60 * 1000 }, // 20 follows / min
};

export function checkRateLimit(action: "reports" | "follows", userId: string): { allowed: boolean; waitSeconds?: number } {
  try {
    const key = `flick:ratelimit:${action}:${userId}`;
    const now = Date.now();
    const records: number[] = JSON.parse(localStorage.getItem(key) || "[]");
    const windowConfig = RATE_LIMIT_WINDOWS[action];

    const activeTimestamps = records.filter((ts) => now - ts < windowConfig.windowMs);
    if (activeTimestamps.length >= windowConfig.max) {
      const oldest = activeTimestamps[0];
      const waitSeconds = Math.ceil((windowConfig.windowMs - (now - oldest)) / 1000);
      return { allowed: false, waitSeconds: Math.max(1, waitSeconds) };
    }

    activeTimestamps.push(now);
    localStorage.setItem(key, JSON.stringify(activeTimestamps));
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

// ========================
// REPORTING
// ========================
export async function submitReport(params: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const limitCheck = checkRateLimit("reports", params.reporterId);
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: `Rate limit reached. Please wait ${limitCheck.waitSeconds}s before submitting another report.`,
    };
  }

  try {
    const { error } = await supabase.from("moderation_reports").insert({
      reporter_id: params.reporterId,
      target_type: params.targetType,
      target_id: params.targetId,
      reason: params.reason,
      note: params.note?.trim() || null,
      status: "open",
    });

    if (error) {
      // Fallback to local storage if table doesn't exist yet in Supabase
      const localKey = "flick:local_reports";
      const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
      existing.push({
        id: "rep_" + Date.now(),
        reporter_id: params.reporterId,
        target_type: params.targetType,
        target_id: params.targetId,
        reason: params.reason,
        note: params.note?.trim() || null,
        status: "open",
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(localKey, JSON.stringify(existing));
    }

    window.dispatchEvent(new CustomEvent("flick:report-submitted", { detail: params }));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit report" };
  }
}

// ========================
// BLOCKING & MUTING
// ========================
export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  if (blockerId === blockedId) return false;
  try {
    await supabase.from("user_blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  } catch {
    // offline/fallback
  }

  // Update local cache
  const key = `flick:blocks:${blockerId}`;
  const list = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
  list.add(blockedId);
  localStorage.setItem(key, JSON.stringify(Array.from(list)));

  window.dispatchEvent(new CustomEvent("flick:user-blocked", { detail: { blockerId, blockedId } }));
  return true;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    await supabase.from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  } catch {
    // offline/fallback
  }

  const key = `flick:blocks:${blockerId}`;
  const list = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
  list.delete(blockedId);
  localStorage.setItem(key, JSON.stringify(Array.from(list)));

  window.dispatchEvent(new CustomEvent("flick:user-unblocked", { detail: { blockerId, blockedId } }));
  return true;
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const localKey = `flick:blocks:${userId}`;
  const local = JSON.parse(localStorage.getItem(localKey) || "[]");

  try {
    const { data } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId);
    if (data) {
      const merged = Array.from(new Set([...local, ...data.map((d: any) => d.blocked_id)]));
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return local;
}

export async function muteUser(userId: string, targetId: string): Promise<boolean> {
  if (userId === targetId) return false;
  try {
    await supabase.from("user_mutes").insert({ user_id: userId, muted_user_id: targetId });
  } catch {}

  const key = `flick:mutes:${userId}`;
  const list = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
  list.add(targetId);
  localStorage.setItem(key, JSON.stringify(Array.from(list)));

  window.dispatchEvent(new CustomEvent("flick:user-muted", { detail: { userId, targetId } }));
  return true;
}

export async function unmuteUser(userId: string, targetId: string): Promise<boolean> {
  try {
    await supabase.from("user_mutes").delete().eq("user_id", userId).eq("muted_user_id", targetId);
  } catch {}

  const key = `flick:mutes:${userId}`;
  const list = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
  list.delete(targetId);
  localStorage.setItem(key, JSON.stringify(Array.from(list)));

  window.dispatchEvent(new CustomEvent("flick:user-unmuted", { detail: { userId, targetId } }));
  return true;
}

export async function getMutedUserIds(userId: string): Promise<string[]> {
  const localKey = `flick:mutes:${userId}`;
  const local = JSON.parse(localStorage.getItem(localKey) || "[]");

  try {
    const { data } = await supabase.from("user_mutes").select("muted_user_id").eq("user_id", userId);
    if (data) {
      const merged = Array.from(new Set([...local, ...data.map((d: any) => d.muted_user_id)]));
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return local;
}

// ========================
// MUTED KEYWORDS
// ========================
export async function getMutedKeywords(userId: string): Promise<string[]> {
  const localKey = `flick:muted_keywords:${userId}`;
  const local = JSON.parse(localStorage.getItem(localKey) || "[]");

  try {
    const { data } = await supabase.from("muted_keywords").select("keyword").eq("user_id", userId);
    if (data) {
      const merged = Array.from(new Set([...local, ...data.map((d: any) => d.keyword.toLowerCase())]));
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return local;
}

export async function addMutedKeyword(userId: string, rawKeyword: string): Promise<string[]> {
  const keyword = rawKeyword.trim().toLowerCase();
  if (!keyword) return getMutedKeywords(userId);

  try {
    await supabase.from("muted_keywords").insert({ user_id: userId, keyword });
  } catch {}

  const localKey = `flick:muted_keywords:${userId}`;
  const existing = new Set<string>(JSON.parse(localStorage.getItem(localKey) || "[]"));
  existing.add(keyword);
  const arr = Array.from(existing);
  localStorage.setItem(localKey, JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent("flick:muted-keywords-changed", { detail: { keywords: arr } }));
  return arr;
}

export async function removeMutedKeyword(userId: string, rawKeyword: string): Promise<string[]> {
  const keyword = rawKeyword.trim().toLowerCase();
  try {
    await supabase.from("muted_keywords").delete().eq("user_id", userId).eq("keyword", keyword);
  } catch {}

  const localKey = `flick:muted_keywords:${userId}`;
  const existing = new Set<string>(JSON.parse(localStorage.getItem(localKey) || "[]"));
  existing.delete(keyword);
  const arr = Array.from(existing);
  localStorage.setItem(localKey, JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent("flick:muted-keywords-changed", { detail: { keywords: arr } }));
  return arr;
}

export function containsMutedKeyword(text: string | null | undefined, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => {
    if (!k) return false;
    // Word boundary or containment
    return lower.includes(k.toLowerCase());
  });
}

// ========================
// MODERATION QUEUE & APPEALS (ADMIN)
// ========================
export async function getModerationQueue(): Promise<ModerationReport[]> {
  try {
    const { data } = await supabase
      .from("moderation_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) return data as ModerationReport[];
  } catch {}

  // Fallback to local storage reports
  const localKey = "flick:local_reports";
  return JSON.parse(localStorage.getItem(localKey) || "[]");
}

export async function resolveModerationReport(
  reportId: string,
  action: "dismissed" | "content_removed" | "user_warned" | "user_suspended",
  adminId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    await supabase.from("moderation_reports").update({
      status: "resolved",
      resolution_action: action,
      resolved_at: now,
      resolved_by: adminId,
    }).eq("id", reportId);
  } catch {}

  // Update local reports
  const localKey = "flick:local_reports";
  const existing: ModerationReport[] = JSON.parse(localStorage.getItem(localKey) || "[]");
  const found = existing.find((r) => r.id === reportId);
  if (found) {
    found.status = "resolved";
    found.resolution_action = action;
    found.resolved_at = now;
    localStorage.setItem(localKey, JSON.stringify(existing));

    // Notify the reporter
    if (found.reporter_id) {
      notify({
        kind: "system",
        title: "Report Resolved",
        message: `Your report regarding a ${found.target_type} has been resolved (${action.replace("_", " ")}). Thank you for keeping Flick safe.`,
        actor: {
          id: adminId,
          display_name: "Flick Safety Team",
          handle: "safety",
          avatar_url: null,
        },
        recipients: [found.reporter_id],
      });
    }
  }

  window.dispatchEvent(new CustomEvent("flick:report-resolved", { detail: { reportId, action } }));
  return true;
}

export async function submitAppeal(reportId: string, userId: string, explanation: string): Promise<boolean> {
  try {
    await supabase.from("moderation_appeals").insert({
      report_id: reportId,
      user_id: userId,
      explanation: explanation.trim(),
    });
    return true;
  } catch {
    const key = `flick:appeal:${reportId}`;
    localStorage.setItem(key, JSON.stringify({ reportId, userId, explanation, created_at: new Date().toISOString() }));
    return true;
  }
}
