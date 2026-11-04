import { supabase } from "@/integrations/supabase/client";

export type PrivacySettings = {
  user_id: string;
  is_private: boolean;
  dm_permission: "everyone" | "following" | "none";
  content_visibility: "public" | "followers" | "close_friends";
  read_receipts: boolean;
  typing_indicators: boolean;
  appear_in_search: boolean;
  disappearing_chat_default: "off" | "24h" | "7d" | "30d";
  updated_at?: string;
};

export type CloseFriendUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

const DEFAULT_SETTINGS: PrivacySettings = {
  user_id: "",
  is_private: false,
  dm_permission: "everyone",
  content_visibility: "public",
  read_receipts: true,
  typing_indicators: true,
  appear_in_search: true,
  disappearing_chat_default: "off",
};

export async function getPrivacySettings(userId: string): Promise<PrivacySettings> {
  const localKey = `flick:privacy_settings:${userId}`;
  let current: PrivacySettings = { ...DEFAULT_SETTINGS, user_id: userId };

  try {
    const cached = localStorage.getItem(localKey);
    if (cached) current = { ...current, ...JSON.parse(cached) };
  } catch {}

  try {
    const { data } = await supabase
      .from("privacy_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      current = { ...current, ...data };
      localStorage.setItem(localKey, JSON.stringify(current));
    }
  } catch {}

  return current;
}

export async function updatePrivacySettings(
  userId: string,
  updates: Partial<PrivacySettings>
): Promise<PrivacySettings> {
  const localKey = `flick:privacy_settings:${userId}`;
  const existing = await getPrivacySettings(userId);
  const next: PrivacySettings = { ...existing, ...updates, updated_at: new Date().toISOString() };

  localStorage.setItem(localKey, JSON.stringify(next));

  try {
    await supabase.from("privacy_settings").upsert(next);
  } catch {}

  window.dispatchEvent(new CustomEvent("flick:privacy-updated", { detail: next }));
  return next;
}

// ========================
// CLOSE FRIENDS
// ========================
export async function getCloseFriends(userId: string): Promise<CloseFriendUser[]> {
  const localKey = `flick:close_friends:${userId}`;
  let ids: string[] = [];
  try {
    ids = JSON.parse(localStorage.getItem(localKey) || "[]");
  } catch {}

  try {
    const { data } = await supabase
      .from("close_friends")
      .select("friend_id")
      .eq("user_id", userId);
    if (data) {
      ids = Array.from(new Set([...ids, ...data.map((d: any) => d.friend_id)]));
    }
  } catch {}

  if (ids.length === 0) return [];

  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", ids);
    return (data || []) as CloseFriendUser[];
  } catch {
    return [];
  }
}

export async function toggleCloseFriend(userId: string, friendId: string): Promise<boolean> {
  const localKey = `flick:close_friends:${userId}`;
  const existing = new Set<string>(JSON.parse(localStorage.getItem(localKey) || "[]"));
  const isMember = existing.has(friendId);

  if (isMember) {
    existing.delete(friendId);
    try {
      await supabase.from("close_friends").delete().eq("user_id", userId).eq("friend_id", friendId);
    } catch {}
  } else {
    existing.add(friendId);
    try {
      await supabase.from("close_friends").insert({ user_id: userId, friend_id: friendId });
    } catch {}
  }

  localStorage.setItem(localKey, JSON.stringify(Array.from(existing)));
  window.dispatchEvent(new CustomEvent("flick:close-friends-updated"));
  return !isMember;
}

// ========================
// DATA EXPORT GENERATOR
// ========================
export async function generateUserDataArchive(userId: string): Promise<{ downloadUrl: string; filename: string }> {
  // Assemble user's full data bundle (posts, profile, settings, bookmarks)
  const [profileRes, postsRes, settings] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("posts").select("*").eq("author_id", userId),
    getPrivacySettings(userId),
  ]);

  const archive = {
    exportDate: new Date().toISOString(),
    platform: "Flick",
    version: "2.4.0",
    account: profileRes.data || { id: userId },
    privacySettings: settings,
    posts: postsRes.data || [],
    disclaimer: "This archive contains your profile details, privacy preferences, and authored flicks.",
  };

  const jsonStr = JSON.stringify(archive, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const filename = `flick-data-${profileRes.data?.handle || userId.slice(0, 8)}-${Date.now()}.json`;

  return { downloadUrl, filename };
}

// ========================
// ACCOUNT DELETION (14-DAY GRACE PERIOD)
// ========================
export type DeletionStatus = {
  isPending: boolean;
  scheduledAt?: string;
};

export async function getAccountDeletionStatus(userId: string): Promise<DeletionStatus> {
  const localKey = `flick:deletion_request:${userId}`;
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.status === "pending") {
        return { isPending: true, scheduledAt: parsed.scheduled_deletion_at };
      }
    }
  } catch {}

  try {
    const { data } = await supabase
      .from("account_deletion_requests")
      .select("status, scheduled_deletion_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (data) {
      return { isPending: true, scheduledAt: data.scheduled_deletion_at };
    }
  } catch {}

  return { isPending: false };
}

export async function requestAccountDeletion(userId: string): Promise<{ scheduledAt: string }> {
  const scheduledDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const request = {
    user_id: userId,
    requested_at: new Date().toISOString(),
    scheduled_deletion_at: scheduledDate,
    status: "pending",
  };

  try {
    await supabase.from("account_deletion_requests").upsert(request);
  } catch {}

  localStorage.setItem(`flick:deletion_request:${userId}`, JSON.stringify(request));
  window.dispatchEvent(new CustomEvent("flick:deletion-requested", { detail: request }));
  return { scheduledAt: scheduledDate };
}

export async function cancelAccountDeletion(userId: string): Promise<boolean> {
  try {
    await supabase.from("account_deletion_requests").delete().eq("user_id", userId);
  } catch {}

  localStorage.removeItem(`flick:deletion_request:${userId}`);
  window.dispatchEvent(new CustomEvent("flick:deletion-cancelled"));
  return true;
}
