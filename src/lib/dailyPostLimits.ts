import { supabase } from "@/integrations/supabase/client";

export const UNVERIFIED_DAILY_LIMIT = 9;
export const VERIFIED_DAILY_LIMIT = 12;

export function getDailyPostLimit(isVerified: boolean): number {
  return isVerified ? VERIFIED_DAILY_LIMIT : UNVERIFIED_DAILY_LIMIT;
}

function getTodayStorageKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `flick:post-count:${userId}:${today}`;
}

export function getCachedTodayCount(userId: string): number {
  if (typeof window === "undefined" || !userId) return 0;
  try {
    const raw = localStorage.getItem(getTodayStorageKey(userId));
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setCachedTodayCount(userId: string, count: number): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(getTodayStorageKey(userId), String(count));
    window.dispatchEvent(
      new CustomEvent("flick:daily-limit-updated", {
        detail: { userId, count },
      })
    );
  } catch {
    /* noop */
  }
}

export function recordPostCreation(userId: string): number {
  const current = getCachedTodayCount(userId);
  const next = current + 1;
  setCachedTodayCount(userId, next);
  return next;
}

/**
 * Queries Supabase for today's post count created by this user
 */
export async function fetchTodayPostCount(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
      .gte("created_at", today.toISOString());

    if (error) {
      return getCachedTodayCount(userId);
    }

    const finalCount = count ?? 0;
    setCachedTodayCount(userId, finalCount);
    return finalCount;
  } catch {
    return getCachedTodayCount(userId);
  }
}

export async function checkDailyPostLimit(
  userId: string,
  isVerified: boolean
): Promise<{
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  isVerified: boolean;
}> {
  const limit = getDailyPostLimit(isVerified);
  const count = await fetchTodayPostCount(userId);
  const remaining = Math.max(0, limit - count);

  return {
    allowed: remaining > 0,
    count,
    limit,
    remaining,
    isVerified,
  };
}
