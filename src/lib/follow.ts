import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export const FOLLOWING_EVENT = "flick:following-updated";
export const FLICKERS_EVENT = "flick:flickers-updated";

function getStorageKey(userId: string) {
  return `flick:flicking:${userId}`;
}

export function getLocalFollowing(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveLocalFollowing(userId: string, followedIds: string[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const unique = [...new Set(followedIds)];
    localStorage.setItem(getStorageKey(userId), JSON.stringify(unique));
    window.dispatchEvent(new CustomEvent(FOLLOWING_EVENT, { detail: { userId, flicking: unique } }));
  } catch {
    /* noop */
  }
}

/**
 * Get all user IDs that the specified user is "Flicking" (following).
 * Backed by actual database records from user_settings.theme.following.
 */
export async function getFlickingUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const local = getLocalFollowing(userId);

  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("theme")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return local;
    }

    const themeObj = (data.theme as Record<string, unknown>) || {};
    const remoteFollowing = Array.isArray(themeObj?.following) ? (themeObj.following as string[]) : [];

    const merged = [...new Set([...local, ...remoteFollowing])];
    if (merged.length !== local.length) {
      saveLocalFollowing(userId, merged);
    }
    return merged;
  } catch {
    return local;
  }
}

// Backward-compatible alias
export const getFollowedUserIds = getFlickingUserIds;

/**
 * Get all user IDs of "Flickers" (followers) of a specific user.
 * Queries actual database records of users whose theme.following contains targetUserId.
 * STRICT: Absolutely no fabricated social data. Returns genuine database count.
 */
export async function getFlickerUserIds(targetUserId: string): Promise<string[]> {
  if (!targetUserId) return [];

  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("user_id, theme");

    if (error || !data) {
      return [];
    }

    const followers: string[] = [];
    for (const row of data) {
      if (!row || row.user_id === targetUserId) continue;
      const themeObj = (row.theme as Record<string, unknown>) || {};
      const followingList = Array.isArray(themeObj?.following) ? (themeObj.following as string[]) : [];
      if (followingList.includes(targetUserId)) {
        followers.push(row.user_id);
      }
    }

    return followers;
  } catch {
    return [];
  }
}

/**
 * Fetches accurate social counts for a user from real database records:
 * - Flickers: Number of users who follow this user
 * - Flicking: Number of accounts this user follows
 * - Flicks: Number of posts created by this user
 */
export async function getFlickSocialStats(userId: string): Promise<{
  flickers: number;
  flicking: number;
  flicks: number;
}> {
  if (!userId) {
    return { flickers: 0, flicking: 0, flicks: 0 };
  }

  const [flickingList, flickerList, postCountResult] = await Promise.all([
    getFlickingUserIds(userId),
    getFlickerUserIds(userId),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
  ]);

  return {
    flicking: flickingList.length,
    flickers: flickerList.length,
    flicks: postCountResult.count ?? 0,
  };
}

/**
 * Follow (Flick) a creator. Backed by real database persistence.
 */
export async function followUser(
  currentUserId: string,
  targetUserId: string,
  actorProfile?: { id?: string; handle?: string | null; display_name?: string | null }
): Promise<string[]> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return [];
  const existing = await getFlickingUserIds(currentUserId);
  if (existing.includes(targetUserId)) return existing;

  const updated = [...existing, targetUserId];
  saveLocalFollowing(currentUserId, updated);

  try {
    const { data } = await supabase
      .from("user_settings")
      .select("theme")
      .eq("user_id", currentUserId)
      .maybeSingle();

    const curTheme = (data?.theme as Record<string, unknown>) || {};
    await supabase.from("user_settings").upsert({
      user_id: currentUserId,
      theme: { ...curTheme, following: updated } as never,
      updated_at: new Date().toISOString(),
    });

    // Notify target user that someone is now Flicking them
    const who = actorProfile?.display_name || actorProfile?.handle || "A Flicker";
    void notify({
      kind: "follow",
      title: `${who} is now flicking you ⚡️`,
      message: "View their profile and flick back",
      actor: actorProfile
        ? {
            id: currentUserId,
            handle: actorProfile.handle ?? null,
            display_name: actorProfile.display_name ?? null,
          }
        : { id: currentUserId },
      recipients: [targetUserId],
      url: `/u/${actorProfile?.handle || currentUserId}`,
      dedupe_id: `follow:${currentUserId}:${targetUserId}`,
    });

    window.dispatchEvent(
      new CustomEvent(FLICKERS_EVENT, { detail: { targetUserId, followerId: currentUserId, action: "follow" } })
    );
  } catch (err) {
    console.warn("[followUser] Database sync warning:", err);
  }

  return updated;
}

/**
 * Unfollow (Unflick) a creator.
 */
export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<string[]> {
  if (!currentUserId || !targetUserId) return [];
  const existing = await getFlickingUserIds(currentUserId);
  const updated = existing.filter((id) => id !== targetUserId);
  saveLocalFollowing(currentUserId, updated);

  try {
    const { data } = await supabase
      .from("user_settings")
      .select("theme")
      .eq("user_id", currentUserId)
      .maybeSingle();

    const curTheme = (data?.theme as Record<string, unknown>) || {};
    await supabase.from("user_settings").upsert({
      user_id: currentUserId,
      theme: { ...curTheme, following: updated } as never,
      updated_at: new Date().toISOString(),
    });

    window.dispatchEvent(
      new CustomEvent(FLICKERS_EVENT, { detail: { targetUserId, followerId: currentUserId, action: "unfollow" } })
    );
  } catch (err) {
    console.warn("[unfollowUser] Database sync warning:", err);
  }

  return updated;
}
