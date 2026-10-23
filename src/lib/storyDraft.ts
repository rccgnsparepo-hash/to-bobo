import { saveDraftBlob, getDraftBlob, deleteDraftBlob } from "./mediaDraftStorage";

export interface StoryDraftMetadata {
  tab: "photos" | "video" | "record";
  recordDuration: number;
  facing: "user" | "environment";
  hasRecordedVideo: boolean;
  savedAt: number;
  fileName?: string;
  mimeType?: string;
}

const STORY_DRAFT_KEY = "flick:story_composer_draft_meta";
const STORY_DRAFT_BLOB_KEY = "flick:story_draft_video_blob";

/**
 * Check if a story draft exists in localStorage
 */
export function hasStoryDraft(): boolean {
  try {
    const raw = localStorage.getItem(STORY_DRAFT_KEY);
    return Boolean(raw);
  } catch {
    return false;
  }
}

/**
 * Save story composer draft to localStorage and IndexedDB (for video blob)
 */
export async function saveStoryDraft(params: {
  tab: "photos" | "video" | "record";
  recordDuration: number;
  facing: "user" | "environment";
  videoBlob?: Blob | null;
  fileName?: string;
}): Promise<void> {
  try {
    const { tab, recordDuration, facing, videoBlob, fileName } = params;

    let hasRecordedVideo = false;
    let mimeType = "";

    if (videoBlob && videoBlob.size > 0) {
      await saveDraftBlob(STORY_DRAFT_BLOB_KEY, videoBlob);
      hasRecordedVideo = true;
      mimeType = videoBlob.type;
    } else {
      await deleteDraftBlob(STORY_DRAFT_BLOB_KEY);
    }

    const metadata: StoryDraftMetadata = {
      tab,
      recordDuration,
      facing,
      hasRecordedVideo,
      savedAt: Date.now(),
      fileName: fileName || `draft-recording-${Date.now()}.webm`,
      mimeType: mimeType || "video/webm",
    };

    localStorage.setItem(STORY_DRAFT_KEY, JSON.stringify(metadata));
    window.dispatchEvent(new CustomEvent("flick:story-draft-updated"));
  } catch (err) {
    console.warn("[StoryDraft] Failed to save draft:", err);
  }
}

/**
 * Load story draft from localStorage and IndexedDB
 */
export async function loadStoryDraft(): Promise<{
  metadata: StoryDraftMetadata;
  videoBlob: Blob | null;
  videoUrl: string | null;
} | null> {
  try {
    const raw = localStorage.getItem(STORY_DRAFT_KEY);
    if (!raw) return null;

    const metadata = JSON.parse(raw) as StoryDraftMetadata;
    let videoBlob: Blob | null = null;
    let videoUrl: string | null = null;

    if (metadata.hasRecordedVideo) {
      videoBlob = await getDraftBlob(STORY_DRAFT_BLOB_KEY);
      if (videoBlob) {
        videoUrl = URL.createObjectURL(videoBlob);
      }
    }

    return { metadata, videoBlob, videoUrl };
  } catch (err) {
    console.warn("[StoryDraft] Failed to load draft:", err);
    return null;
  }
}

/**
 * Delete story draft from localStorage and IndexedDB
 */
export async function clearStoryDraft(): Promise<void> {
  try {
    localStorage.removeItem(STORY_DRAFT_KEY);
    await deleteDraftBlob(STORY_DRAFT_BLOB_KEY);
    window.dispatchEvent(new CustomEvent("flick:story-draft-updated"));
  } catch (err) {
    console.warn("[StoryDraft] Failed to clear draft:", err);
  }
}
