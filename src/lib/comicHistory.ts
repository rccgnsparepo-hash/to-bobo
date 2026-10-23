/**
 * Comic Reading Progress & Bookmark Engine
 * Tracks exact page bookmarks, completion percentages, resume locations, and start-over capabilities.
 */

export interface ReadingProgress {
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string;
  currentPage: number;
  totalPages: number;
  scrollPercent: number;
  scrollY: number;
  lastReadAt: number;
  completed: boolean;
}

const STORAGE_KEY = "flick:comic_reading_progress";
const BOOK_CACHE_PREFIX = "flick:comic_book_cache:";

export function getAllReadingProgress(): Record<string, ReadingProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getBookProgress(bookId: number | string): ReadingProgress | null {
  const all = getAllReadingProgress();
  return all[String(bookId)] || null;
}

export function saveComicProgress(params: {
  comicId: string;
  title: string;
  author: string;
  coverUrl?: string;
  currentPage: number;
  totalPages: number;
  scrollY?: number;
}) {
  try {
    const all = getAllReadingProgress();
    const pct =
      params.totalPages > 0
        ? Math.min(100, Math.max(1, Math.round((params.currentPage / params.totalPages) * 100)))
        : 0;

    all[params.comicId] = {
      bookId: params.comicId,
      title: params.title,
      author: params.author,
      coverUrl: params.coverUrl,
      currentPage: params.currentPage,
      totalPages: params.totalPages,
      scrollPercent: pct,
      scrollY: params.scrollY ?? 0,
      lastReadAt: Date.now(),
      completed: params.currentPage >= params.totalPages,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("flick:comic-progress-updated", { detail: all }));
  } catch {}
}

export function saveBookProgress(progress: {
  bookId: number | string;
  title: string;
  author: string;
  coverUrl?: string;
  scrollPercent: number;
  scrollY: number;
  completed?: boolean;
}) {
  saveComicProgress({
    comicId: String(progress.bookId),
    title: progress.title,
    author: progress.author,
    coverUrl: progress.coverUrl,
    currentPage: Math.max(1, Math.round((progress.scrollPercent / 100) * 30)),
    totalPages: 30,
    scrollY: progress.scrollY,
  });
}

export function resetBookProgress(bookId: number | string) {
  try {
    const all = getAllReadingProgress();
    const key = String(bookId);
    if (all[key]) {
      all[key].currentPage = 1;
      all[key].scrollPercent = 0;
      all[key].scrollY = 0;
      all[key].completed = false;
      all[key].lastReadAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent("flick:comic-progress-updated", { detail: all }));
    }
  } catch {}
}

export function cacheBookText(bookId: number | string, text: string, metadata: unknown) {
  try {
    localStorage.setItem(
      `${BOOK_CACHE_PREFIX}${bookId}`,
      JSON.stringify({ text, metadata, cachedAt: Date.now() })
    );
  } catch {}
}

export function getCachedBookText(bookId: number | string): { text: string; metadata: unknown } | null {
  try {
    const raw = localStorage.getItem(`${BOOK_CACHE_PREFIX}${bookId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
