import { saveDraftBlob, getDraftBlob, deleteDraftBlob } from "./mediaDraftStorage";

export interface ChatVnDraftMetadata {
  userId: string;
  duration: number;
  mimeType: string;
  savedAt: number;
}

const CHAT_TEXT_PREFIX = "flick:chat_draft_text:";
const CHAT_VN_META_PREFIX = "flick:chat_draft_vn_meta:";
const CHAT_VN_BLOB_PREFIX = "flick:chat_draft_vn_blob:";

/**
 * Save chat text draft to localStorage
 */
export function saveChatTextDraft(userId: string, text: string): void {
  if (!userId) return;
  try {
    const key = `${CHAT_TEXT_PREFIX}${userId}`;
    const trimmed = text.trim();
    if (!trimmed) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(
        key,
        JSON.stringify({
          text,
          updatedAt: Date.now(),
        })
      );
    }
    window.dispatchEvent(new CustomEvent("flick:chat-draft-updated", { detail: { userId } }));
  } catch (err) {
    console.warn("[ChatDraft] Error saving text draft:", err);
  }
}

/**
 * Get chat text draft from localStorage
 */
export function getChatTextDraft(userId: string): string {
  if (!userId) return "";
  try {
    const key = `${CHAT_TEXT_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.text || "";
  } catch {
    return "";
  }
}

/**
 * Clear text draft for a user
 */
export function clearChatTextDraft(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${CHAT_TEXT_PREFIX}${userId}`);
    window.dispatchEvent(new CustomEvent("flick:chat-draft-updated", { detail: { userId } }));
  } catch (err) {
    console.warn("[ChatDraft] Error clearing text draft:", err);
  }
}

/**
 * Save voice note (VN) draft to IndexedDB & localStorage metadata
 */
export async function saveChatVnDraft(
  userId: string,
  blob: Blob,
  durationSeconds: number
): Promise<void> {
  if (!userId || !blob || blob.size === 0) return;
  try {
    const blobKey = `${CHAT_VN_BLOB_PREFIX}${userId}`;
    const metaKey = `${CHAT_VN_META_PREFIX}${userId}`;

    await saveDraftBlob(blobKey, blob);

    const meta: ChatVnDraftMetadata = {
      userId,
      duration: Math.max(1, Math.round(durationSeconds)),
      mimeType: blob.type || "audio/webm",
      savedAt: Date.now(),
    };

    localStorage.setItem(metaKey, JSON.stringify(meta));
    window.dispatchEvent(new CustomEvent("flick:chat-draft-updated", { detail: { userId } }));
  } catch (err) {
    console.warn("[ChatDraft] Error saving VN draft:", err);
  }
}

/**
 * Retrieve voice note (VN) draft for a user
 */
export async function getChatVnDraft(
  userId: string
): Promise<{ blob: Blob; url: string; duration: number } | null> {
  if (!userId) return null;
  try {
    const metaKey = `${CHAT_VN_META_PREFIX}${userId}`;
    const raw = localStorage.getItem(metaKey);
    if (!raw) return null;

    const meta = JSON.parse(raw) as ChatVnDraftMetadata;
    const blobKey = `${CHAT_VN_BLOB_PREFIX}${userId}`;
    const blob = await getDraftBlob(blobKey);

    if (!blob) {
      localStorage.removeItem(metaKey);
      return null;
    }

    const url = URL.createObjectURL(blob);
    return {
      blob,
      url,
      duration: meta.duration,
    };
  } catch (err) {
    console.warn("[ChatDraft] Error getting VN draft:", err);
    return null;
  }
}

/**
 * Clear voice note (VN) draft for a user
 */
export async function clearChatVnDraft(userId: string): Promise<void> {
  if (!userId) return;
  try {
    localStorage.removeItem(`${CHAT_VN_META_PREFIX}${userId}`);
    await deleteDraftBlob(`${CHAT_VN_BLOB_PREFIX}${userId}`);
    window.dispatchEvent(new CustomEvent("flick:chat-draft-updated", { detail: { userId } }));
  } catch (err) {
    console.warn("[ChatDraft] Error clearing VN draft:", err);
  }
}

/**
 * Clear both text and VN drafts for a user
 */
export async function clearAllChatDrafts(userId: string): Promise<void> {
  if (!userId) return;
  clearChatTextDraft(userId);
  await clearChatVnDraft(userId);
}

/**
 * Get draft status summary for a user
 */
export function getChatDraftSummary(userId: string): {
  hasDraft: boolean;
  text?: string;
  hasVn?: boolean;
  vnDuration?: number;
} {
  if (!userId) return { hasDraft: false };

  const text = getChatTextDraft(userId);
  let hasVn = false;
  let vnDuration = 0;

  try {
    const vnMeta = localStorage.getItem(`${CHAT_VN_META_PREFIX}${userId}`);
    if (vnMeta) {
      const parsed = JSON.parse(vnMeta) as ChatVnDraftMetadata;
      hasVn = true;
      vnDuration = parsed.duration;
    }
  } catch {
    hasVn = false;
  }

  return {
    hasDraft: Boolean(text.trim()) || hasVn,
    text: text.trim() || undefined,
    hasVn,
    vnDuration: hasVn ? vnDuration : undefined,
  };
}

/**
 * Retrieve all chat drafts across all conversations to display in Messages list
 */
export function getAllChatDrafts(): Record<
  string,
  { text?: string; hasVn?: boolean; vnDuration?: number; updatedAt: number }
> {
  const drafts: Record<
    string,
    { text?: string; hasVn?: boolean; vnDuration?: number; updatedAt: number }
  > = {};

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(CHAT_TEXT_PREFIX)) {
        const userId = key.replace(CHAT_TEXT_PREFIX, "");
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.text?.trim()) {
            drafts[userId] = drafts[userId] || { updatedAt: parsed.updatedAt || Date.now() };
            drafts[userId].text = parsed.text.trim();
          }
        }
      } else if (key.startsWith(CHAT_VN_META_PREFIX)) {
        const userId = key.replace(CHAT_VN_META_PREFIX, "");
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatVnDraftMetadata;
          drafts[userId] = drafts[userId] || { updatedAt: parsed.savedAt || Date.now() };
          drafts[userId].hasVn = true;
          drafts[userId].vnDuration = parsed.duration;
        }
      }
    }
  } catch (err) {
    console.warn("[ChatDraft] Error listing drafts:", err);
  }

  return drafts;
}
