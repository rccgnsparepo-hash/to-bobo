import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

// Story viewer tracking & persistence module.
// Real viewers only:
// 1. Authors NEVER count as viewers on their own stories.
// 2. Only the story author can see who viewed their story and the view count.
// 3. Views are synchronized in real-time across devices via Supabase Realtime channels.
// 4. Stale/fake viewers and timestamps older than the story creation time are strictly purged.

export type StoryViewerUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  viewed_at: string;
  reaction?: string | null;
};

export type StoryViewsData = {
  totalCount: number;
  viewers: StoryViewerUser[];
  reactions: Record<string, number>;
};

const STORAGE_KEY_PREFIX = "flick:story_views:";

function getStorageKey(storyId: string) {
  return `${STORAGE_KEY_PREFIX}${storyId}`;
}

/**
 * Filter out invalid users, decoy seed IDs, the story author, and any timestamps
 * that are chronologically impossible (e.g. before the story was created).
 */
export function sanitizeViewers(
  viewers: StoryViewerUser[],
  authorId?: string,
  storyCreatedAt?: string
): StoryViewerUser[] {
  if (!Array.isArray(viewers)) return [];
  const seen = new Set<string>();
  const storyTime = storyCreatedAt ? new Date(storyCreatedAt).getTime() : 0;

  return viewers.filter((v) => {
    if (!v || !v.id) return false;
    if (v.id.startsWith("u-")) return false; // remove seed profiles
    if (authorId && v.id === authorId) return false; // author CANNOT be counted as a viewer
    if (seen.has(v.id)) return false;

    // Purge fake or stale timestamps that occurred prior to story creation
    if (storyTime > 0 && v.viewed_at) {
      const viewerTime = new Date(v.viewed_at).getTime();
      // Allow a 10s grace period for clock skew, but reject anything older (e.g. 1 day ago)
      if (viewerTime < storyTime - 10000) {
        return false;
      }
    }

    seen.add(v.id);
    return true;
  });
}

/**
 * Fetch real story views from local cache and sanitize against authorId and story creation time.
 */
export function getStoryViews(
  storyId: string,
  authorId?: string,
  storyCreatedAt?: string
): StoryViewsData {
  let localViewers: StoryViewerUser[] = [];
  try {
    const raw = localStorage.getItem(getStorageKey(storyId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.viewers)) {
        localViewers = sanitizeViewers(parsed.viewers, authorId, storyCreatedAt);
      }
    }
  } catch (err) {
    console.error("Error reading cached story views:", err);
  }

  const reactions: Record<string, number> = {};
  localViewers.forEach((v) => {
    if (v.reaction) {
      reactions[v.reaction] = (reactions[v.reaction] || 0) + 1;
    }
  });

  return {
    totalCount: localViewers.length,
    viewers: localViewers,
    reactions,
  };
}

/**
 * Fetch remote story views for the story author from Supabase.
 * ONLY fetches actual views from story_tags for this exact storyId.
 * NEVER queries broadcast announcements from notifications which created fake "1 day ago" entries!
 */
export async function syncStoryViewsFromRemote(
  storyId: string,
  authorId: string,
  storyCreatedAt?: string
): Promise<StoryViewsData> {
  const current = getStoryViews(storyId, authorId, storyCreatedAt);
  const existingMap = new Map<string, StoryViewerUser>();
  current.viewers.forEach((v) => {
    if (v.id !== authorId) existingMap.set(v.id, v);
  });

  try {
    const collectedViewerIds = new Set<string>();

    // 1. Fetch story_tags (tracks real viewers who opened this specific storyId)
    const { data: tags, error: tagErr } = await supabase
      .from("story_tags")
      .select("story_id, user_id")
      .eq("story_id", storyId);

    if (!tagErr && Array.isArray(tags)) {
      tags.forEach((t) => {
        if (t.user_id && t.user_id !== authorId) {
          collectedViewerIds.add(t.user_id);
        }
      });
    }

    // 2. Fetch user profiles for all collected viewer IDs in one batch query
    const viewerIdsToFetch = Array.from(collectedViewerIds).filter(
      (id) => !existingMap.has(id) && id !== authorId
    );

    if (viewerIdsToFetch.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", viewerIdsToFetch);

      if (!profErr && Array.isArray(profiles)) {
        profiles.forEach((p) => {
          if (p.id && p.id !== authorId && !existingMap.has(p.id)) {
            existingMap.set(p.id, {
              id: p.id,
              handle: p.handle || "user",
              display_name: p.display_name || "Flicker",
              avatar_url: p.avatar_url || null,
              viewed_at: new Date().toISOString(),
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn("[storyViews] syncStoryViewsFromRemote error:", err);
  }

  // Filter out any author entry, seed IDs, or chronologically impossible timestamps
  const rawList = Array.from(existingMap.values());
  const updatedViewers = sanitizeViewers(rawList, authorId, storyCreatedAt);

  const reactions: Record<string, number> = {};
  updatedViewers.forEach((v) => {
    if (v.reaction) reactions[v.reaction] = (reactions[v.reaction] || 0) + 1;
  });

  const updatedData: StoryViewsData = {
    totalCount: updatedViewers.length,
    viewers: updatedViewers,
    reactions,
  };

  try {
    localStorage.setItem(getStorageKey(storyId), JSON.stringify(updatedData));
  } catch {}

  window.dispatchEvent(
    new CustomEvent("flick:story-views-updated", { detail: { storyId, data: updatedData } })
  );

  return updatedData;
}

/**
 * Record a real story view when a user actually opens a story.
 * If user is the author, it is NEVER recorded as a view!
 */
export async function recordStoryView(
  storyId: string,
  user: { id: string; handle: string; display_name: string; avatar_url: string | null },
  authorId?: string,
  storyCreatedAt?: string
): Promise<StoryViewsData> {
  const current = getStoryViews(storyId, authorId, storyCreatedAt);

  // STRICT RULE: If viewer IS the author of the story, DO NOT RECORD!
  if (authorId && user.id === authorId) {
    return current;
  }

  // Check if viewer is already recorded in local cache
  const isAlreadyViewed = current.viewers.some((v) => v.id === user.id);

  const nowIso = new Date().toISOString();
  const newViewer: StoryViewerUser = {
    id: user.id,
    handle: user.handle,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    viewed_at: nowIso,
    reaction: null,
  };

  const updatedViewers = isAlreadyViewed
    ? current.viewers
    : [newViewer, ...current.viewers].filter((v) => v.id !== authorId);

  const updated: StoryViewsData = {
    totalCount: updatedViewers.length,
    viewers: updatedViewers,
    reactions: { ...current.reactions },
  };

  try {
    localStorage.setItem(getStorageKey(storyId), JSON.stringify(updated));
  } catch {}

  // 1. Broadcast view event via Realtime channel to author in real-time
  try {
    const ch = supabase.channel(`story-views:${storyId}`);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({
          type: "broadcast",
          event: "story-view",
          payload: {
            storyId,
            authorId,
            viewer: newViewer,
          },
        });
      }
    });
  } catch {}

  // 2. Persist view in Supabase story_tags for this story
  if (authorId && authorId !== user.id && !isAlreadyViewed) {
    try {
      void supabase
        .from("story_tags")
        .insert({
          story_id: storyId,
          user_id: user.id,
        })
        .then(({ error }) => {
          if (error) console.warn("[storyViews] story_tags insert:", error.message);
        });
    } catch {}
  }

  window.dispatchEvent(
    new CustomEvent("flick:story-views-updated", { detail: { storyId, data: updated } })
  );

  return updated;
}

/**
 * Add an emoji reaction to the story segment.
 * STRICT ENFORCEMENT: A user can NEVER react to their own story!
 */
export async function addStoryReaction(
  storyId: string,
  user: { id: string; handle: string; display_name: string; avatar_url: string | null },
  emoji: string,
  authorId?: string
): Promise<StoryViewsData> {
  const current = getStoryViews(storyId, authorId);

  // CRITICAL SECURITY & LOGICAL RULE: Users must NOT react to their own stories!
  if (authorId && user.id === authorId) {
    console.warn(`[storyViews] Blocked self-reaction attempt by author ${user.id} on story ${storyId}`);
    return current;
  }

  let updatedViewers = [...current.viewers].filter((v) => v.id !== authorId);
  const idx = updatedViewers.findIndex((v) => v.id === user.id);

  if (idx !== -1) {
    updatedViewers[idx] = { ...updatedViewers[idx], reaction: emoji };
  } else {
    updatedViewers.unshift({
      id: user.id,
      handle: user.handle,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      viewed_at: new Date().toISOString(),
      reaction: emoji,
    });
  }

  const reactions: Record<string, number> = {};
  updatedViewers.forEach((v) => {
    if (v.reaction) {
      reactions[v.reaction] = (reactions[v.reaction] || 0) + 1;
    }
  });

  const updated: StoryViewsData = {
    totalCount: updatedViewers.length,
    viewers: updatedViewers,
    reactions,
  };

  try {
    localStorage.setItem(getStorageKey(storyId), JSON.stringify(updated));
  } catch {}

  // Broadcast reaction to the author in real-time
  try {
    const ch = supabase.channel(`story-views:${storyId}`);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({
          type: "broadcast",
          event: "story-reaction",
          payload: {
            storyId,
            authorId,
            viewerId: user.id,
            emoji,
          },
        });
      }
    });
  } catch {}

  if (authorId && authorId !== user.id) {
    void notify({
      kind: "story",
      message: `${user.display_name} reacted ${emoji} to your story`,
      actor: {
        id: user.id,
        handle: user.handle,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      recipients: [authorId],
      data: {
        story_id: storyId,
        reaction: emoji,
        type: "story_reaction",
      },
    });
  }

  window.dispatchEvent(
    new CustomEvent("flick:story-views-updated", { detail: { storyId, data: updated } })
  );

  return updated;
}

/**
 * Listen for real-time views updates on a story segment.
 */
export function listenStoryViews(
  storyId: string,
  cb: (data: StoryViewsData) => void,
  authorId?: string,
  storyCreatedAt?: string
): () => void {
  const localHandler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.storyId === storyId) {
      cb(detail.data);
    }
  };

  window.addEventListener("flick:story-views-updated", localHandler);

  // Subscribe to Supabase Realtime broadcast channel
  const ch = supabase
    .channel(`story-views:${storyId}`)
    .on("broadcast", { event: "story-view" }, (payload) => {
      const p = payload.payload as { storyId: string; viewer: StoryViewerUser };
      if (p?.storyId === storyId && p.viewer && (!authorId || p.viewer.id !== authorId)) {
        const current = getStoryViews(storyId, authorId, storyCreatedAt);
        if (!current.viewers.some((v) => v.id === p.viewer.id)) {
          const nextViewers = [p.viewer, ...current.viewers].filter((v) => v.id !== authorId);
          const reactions: Record<string, number> = {};
          nextViewers.forEach((v) => {
            if (v.reaction) reactions[v.reaction] = (reactions[v.reaction] || 0) + 1;
          });
          const nextData: StoryViewsData = {
            totalCount: nextViewers.length,
            viewers: nextViewers,
            reactions,
          };
          try {
            localStorage.setItem(getStorageKey(storyId), JSON.stringify(nextData));
          } catch {}
          cb(nextData);
        }
      }
    })
    .on("broadcast", { event: "story-reaction" }, (payload) => {
      const p = payload.payload as { storyId: string; viewerId: string; emoji: string };
      if (p?.storyId === storyId && p.viewerId) {
        const current = getStoryViews(storyId, authorId, storyCreatedAt);
        const idx = current.viewers.findIndex((v) => v.id === p.viewerId);
        if (idx !== -1) {
          const nextViewers = [...current.viewers];
          nextViewers[idx] = { ...nextViewers[idx], reaction: p.emoji };
          const reactions: Record<string, number> = {};
          nextViewers.forEach((v) => {
            if (v.reaction) reactions[v.reaction] = (reactions[v.reaction] || 0) + 1;
          });
          const nextData: StoryViewsData = {
            totalCount: nextViewers.length,
            viewers: nextViewers,
            reactions,
          };
          try {
            localStorage.setItem(getStorageKey(storyId), JSON.stringify(nextData));
          } catch {}
          cb(nextData);
        }
      }
    })
    .subscribe();

  return () => {
    window.removeEventListener("flick:story-views-updated", localHandler);
    supabase.removeChannel(ch);
  };
}
