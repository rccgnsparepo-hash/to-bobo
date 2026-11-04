import { supabase } from "@/integrations/supabase/client";
import type { PostRow } from "@/components/PostCard";

export type BookmarkFolder = {
  id: string;
  name: string;
  color?: string;
  count?: number;
};

export type BookmarkItem = {
  id: string;
  post_id: string;
  folder_id: string | null;
  created_at: string;
  post?: PostRow | null;
  isUnavailable?: boolean;
};

const DEFAULT_FOLDERS: BookmarkFolder[] = [
  { id: "all", name: "All Saved", color: "#b8ff00" },
  { id: "tech", name: "Tech & Dev", color: "#38bdf8" },
  { id: "memes", name: "Memes & Laughs", color: "#facc15" },
  { id: "vibes", name: "Vibes & Audio", color: "#ec4899" },
];

export async function getBookmarkFolders(userId: string): Promise<BookmarkFolder[]> {
  const localKey = `flick:bookmark_folders:${userId}`;
  let folders: BookmarkFolder[] = [];
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) folders = JSON.parse(cached);
  } catch {}

  try {
    const { data } = await supabase
      .from("bookmark_folders")
      .select("id, name, color")
      .eq("user_id", userId);
    if (data && data.length > 0) {
      folders = data;
    }
  } catch {}

  if (folders.length === 0) {
    folders = DEFAULT_FOLDERS;
    localStorage.setItem(localKey, JSON.stringify(folders));
  }
  return folders;
}

export async function createBookmarkFolder(userId: string, name: string, color = "#b8ff00"): Promise<BookmarkFolder> {
  const newFolder: BookmarkFolder = {
    id: "fld_" + Date.now(),
    name: name.trim(),
    color,
  };

  try {
    const { data } = await supabase
      .from("bookmark_folders")
      .insert({ user_id: userId, name: name.trim(), color })
      .select()
      .maybeSingle();
    if (data) {
      newFolder.id = data.id;
    }
  } catch {}

  const localKey = `flick:bookmark_folders:${userId}`;
  const existing = await getBookmarkFolders(userId);
  const updated = [...existing, newFolder];
  localStorage.setItem(localKey, JSON.stringify(updated));
  return newFolder;
}

export async function isPostBookmarked(userId: string, postId: string): Promise<boolean> {
  const localKey = `flick:bookmarks:${userId}`;
  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem(localKey) || "[]"));
    if (set.has(postId)) return true;
  } catch {}

  try {
    const { data } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function toggleBookmark(
  userId: string,
  postId: string,
  folderId?: string | null
): Promise<{ saved: boolean }> {
  const localKey = `flick:bookmarks:${userId}`;
  const set = new Set<string>(JSON.parse(localStorage.getItem(localKey) || "[]"));
  const currentlySaved = set.has(postId);

  if (currentlySaved) {
    set.delete(postId);
    localStorage.setItem(localKey, JSON.stringify(Array.from(set)));
    try {
      await supabase.from("bookmarks").delete().eq("user_id", userId).eq("post_id", postId);
      await supabase.from("saved_posts").delete().eq("user_id", userId).eq("post_id", postId);
    } catch {}
    window.dispatchEvent(new CustomEvent("flick:bookmarks-changed", { detail: { postId, saved: false } }));
    return { saved: false };
  } else {
    set.add(postId);
    localStorage.setItem(localKey, JSON.stringify(Array.from(set)));
    try {
      await supabase.from("bookmarks").insert({ user_id: userId, post_id: postId, folder_id: folderId || null });
      await supabase.from("saved_posts").insert({ user_id: userId, post_id: postId });
    } catch {}
    window.dispatchEvent(new CustomEvent("flick:bookmarks-changed", { detail: { postId, saved: true } }));
    return { saved: true };
  }
}

export async function getBookmarks(userId: string): Promise<BookmarkItem[]> {
  const localKey = `flick:bookmarks:${userId}`;
  let ids: string[] = JSON.parse(localStorage.getItem(localKey) || "[]");

  try {
    const { data } = await supabase
      .from("bookmarks")
      .select("id, post_id, folder_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      ids = Array.from(new Set([...ids, ...data.map((d: any) => d.post_id)]));
    }
  } catch {}

  if (ids.length === 0) return [];

  // Fetch corresponding posts
  try {
    const { data: postsData } = await supabase
      .from("posts")
      .select(
        "id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)"
      )
      .in("id", ids);

    const postMap = new Map<string, PostRow>();
    (postsData || []).forEach((p: any) => {
      postMap.set(p.id, p as PostRow);
    });

    return ids.map((postId) => {
      const post = postMap.get(postId);
      return {
        id: "bm_" + postId,
        post_id: postId,
        folder_id: null,
        created_at: post?.created_at || new Date().toISOString(),
        post: post || null,
        isUnavailable: !post, // Post deleted or unavailable
      };
    });
  } catch {
    return ids.map((postId) => ({
      id: "bm_" + postId,
      post_id: postId,
      folder_id: null,
      created_at: new Date().toISOString(),
      post: null,
      isUnavailable: true,
    }));
  }
}

export async function bulkRemoveBookmarks(userId: string, postIds: string[]): Promise<boolean> {
  const localKey = `flick:bookmarks:${userId}`;
  const set = new Set<string>(JSON.parse(localStorage.getItem(localKey) || "[]"));
  postIds.forEach((id) => set.delete(id));
  localStorage.setItem(localKey, JSON.stringify(Array.from(set)));

  try {
    await supabase.from("bookmarks").delete().eq("user_id", userId).in("post_id", postIds);
    await supabase.from("saved_posts").delete().eq("user_id", userId).in("post_id", postIds);
  } catch {}

  window.dispatchEvent(new CustomEvent("flick:bookmarks-changed", { detail: { bulk: true, removed: postIds } }));
  return true;
}
