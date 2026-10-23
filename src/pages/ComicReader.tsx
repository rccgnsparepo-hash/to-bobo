import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  BookmarkCheck,
  Download,
  CheckCircle2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  WifiOff,
} from "lucide-react";
import {
  getBookProgress,
  saveComicProgress,
  resetBookProgress,
  type ReadingProgress,
} from "@/lib/comicHistory";
import {
  CURATED_COMICS,
  getComicPageUrl,
  getAllComicPageUrls,
  type ComicIssue,
} from "@/lib/comicsData";
import {
  downloadComicForOffline,
  isComicDownloaded,
  resolveOfflinePageUrl,
} from "@/lib/comicCache";
import { toast } from "sonner";

export default function ComicReaderPage() {
  const { id } = useParams<{ id: string }>();
  const [comic, setComic] = useState<ComicIssue | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageUrl, setPageUrl] = useState<string>("");
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [savedProgress, setSavedProgress] = useState<ReadingProgress | null>(null);
  const [hasRestored, setHasRestored] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [readingMode, setReadingMode] = useState<"flip" | "scroll">("flip");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loadingPage, setLoadingPage] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Load comic definition
  useEffect(() => {
    if (!id) return;
    // Check curated comics first
    let found = CURATED_COMICS.find((c) => c.id === id);
    if (!found) {
      // Try offline cached definition in localStorage
      try {
        const raw = localStorage.getItem(`flick:comic_def:${id}`);
        if (raw) found = JSON.parse(raw);
      } catch {}
    }

    if (!found) {
      // Fallback comic definition for dynamic archive items
      found = {
        id,
        title: id.replace(/[-_]/g, " ").toUpperCase(),
        series: "Archive Comic Issue",
        issueNumber: "#1",
        publisher: "Public Domain Comic Archive",
        year: 1950,
        genre: "graphic-novel",
        coverUrl: `https://archive.org/services/img/${id}`,
        totalPages: 36,
        description: "Classic comic book issue preserved for online and offline reading.",
        archiveIdentifier: id,
        leafBaseUrl: `https://archive.org/download/${id}/page/leaf`,
      };
    }

    setComic(found);
    setIsOfflineCached(isComicDownloaded(found.id));

    // Check reading bookmark
    const progress = getBookProgress(id);
    if (progress) {
      setSavedProgress(progress);
      if (progress.currentPage && progress.currentPage > 1) {
        setCurrentPage(progress.currentPage);
      }
    }
  }, [id]);

  // 2. Resolve current page image URL (from cache if offline)
  useEffect(() => {
    if (!comic) return;
    setLoadingPage(true);
    const rawUrl = getComicPageUrl(comic, currentPage);

    void resolveOfflinePageUrl(rawUrl).then((resolved) => {
      setPageUrl(resolved);
      setLoadingPage(false);
    });

    // Save reading progress on page change
    saveComicProgress({
      comicId: comic.id,
      title: comic.title,
      author: comic.publisher,
      coverUrl: comic.coverUrl,
      currentPage,
      totalPages: comic.totalPages,
    });
  }, [comic, currentPage]);

  const goToNextPage = useCallback(() => {
    if (!comic) return;
    if (currentPage < comic.totalPages) {
      setCurrentPage((p) => p + 1);
    } else {
      toast.success("You reached the end of this comic!");
    }
  }, [comic, currentPage]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  }, [currentPage]);

  // 3. Keyboard navigation (Left / Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readingMode !== "flip") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToPrevPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readingMode, goToNextPage, goToPrevPage]);

  const resumeWhereStopped = () => {
    if (!savedProgress) return;
    setCurrentPage(savedProgress.currentPage || 1);
    setHasRestored(true);
    toast.success(`Resumed at Page ${savedProgress.currentPage || 1}!`);
  };

  const reReadFromStart = () => {
    if (!id) return;
    resetBookProgress(id);
    setCurrentPage(1);
    setSavedProgress(null);
    setHasRestored(true);
    toast.info("Comic reset to Page 1. Enjoy re-reading!");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleDownload = async () => {
    if (!comic || downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    toast.loading(`Downloading all ${comic.totalPages} pages for offline reading...`, { id: "reader-dl" });

    const ok = await downloadComicForOffline(comic, (pct) => {
      setDownloadProgress(pct);
    });

    setDownloading(false);
    if (ok) {
      setIsOfflineCached(true);
      toast.success(`All ${comic.totalPages} pages saved! You can read this completely offline.`, {
        id: "reader-dl",
      });
    } else {
      toast.error("Offline download failed. Please check connection.", { id: "reader-dl" });
    }
  };

  if (!comic) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-snap border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-semibold">Opening comic panels…</p>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((currentPage / comic.totalPages) * 100);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black flex flex-col text-foreground select-none relative overflow-x-hidden"
    >
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-border/80 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/comics"
            className="p-1.5 -ml-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            title="Back to Comic Library"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate text-foreground">{comic.title}</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {comic.series} · Page {currentPage} of {comic.totalPages} ({progressPercent}%)
            </p>
          </div>
        </div>

        {/* Reader Toolbar Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Offline Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className={`px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
              isOfflineCached
                ? "bg-snap/20 text-snap border border-snap/40"
                : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
            }`}
            title={isOfflineCached ? "Saved to offline cache" : "Download issue for offline reading"}
          >
            {downloading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-snap border-t-transparent animate-spin" />
                <span className="text-[10px]">{downloadProgress}%</span>
              </>
            ) : isOfflineCached ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-snap" />
                <span className="hidden sm:inline text-[11px]">Saved Offline</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Download</span>
              </>
            )}
          </button>

          {/* Reading Mode Switcher */}
          <button
            type="button"
            onClick={() => setReadingMode((m) => (m === "flip" ? "scroll" : "flip"))}
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
            title={readingMode === "flip" ? "Switch to Continuous Webtoon Scroll" : "Switch to Single Page Turn"}
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Zoom controls (in flip mode) */}
          {readingMode === "flip" && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))))}
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.2).toFixed(1))))}
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Re-read from beginning */}
          <button
            type="button"
            onClick={reReadFromStart}
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
            title="Re-read from Page 1"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Progress tracking line */}
      <div className="sticky top-12 z-30 w-full h-1 bg-secondary/60">
        <div
          className="h-full bg-snap transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Floating Resume Bookmark Notification */}
      {savedProgress && savedProgress.currentPage > 1 && !hasRestored && (
        <div className="sticky top-14 z-30 mx-4 my-2 p-3 rounded-2xl bg-snap/15 border border-snap/30 backdrop-blur-xl flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <BookmarkCheck className="w-5 h-5 text-snap shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-foreground">
                You previously reached Page {savedProgress.currentPage} ({savedProgress.scrollPercent}%)
              </span>
              <p className="text-[11px] text-muted-foreground">Jump back or restart from the beginning</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={reReadFromStart}
              className="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-[11px] font-semibold transition"
            >
              Start Over
            </button>
            <button
              type="button"
              onClick={resumeWhereStopped}
              className="px-3.5 py-1.5 rounded-full bg-snap text-snap-foreground text-[11px] font-bold shadow transition hover:opacity-95"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Main Comic Reading Surface */}
      {readingMode === "flip" ? (
        /* Single Page / Double Page Flip Mode */
        <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 relative min-h-[75vh]">
          {/* Loading indicator */}
          {loadingPage && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs z-10">
              <div className="w-8 h-8 rounded-full border-2 border-snap border-t-transparent animate-spin" />
            </div>
          )}

          {/* Comic Page Scan */}
          <div
            className="max-w-4xl w-full flex items-center justify-center my-auto transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img
              src={pageUrl || comic.coverUrl}
              alt={`${comic.title} - Page ${currentPage}`}
              className="max-h-[82vh] w-auto max-w-full rounded-xl shadow-2xl object-contain border border-border/40"
              onLoad={() => setLoadingPage(false)}
              onError={(e) => {
                // If specific leaf page fails, fallback to cover or comic panel
                (e.target as HTMLImageElement).src = comic.coverUrl;
                setLoadingPage(false);
              }}
            />
          </div>

          {/* Left / Right touch navigation hit areas */}
          <div
            onClick={goToPrevPage}
            className="absolute left-0 top-16 bottom-24 w-1/4 cursor-w-resize z-20 flex items-center justify-start pl-2 opacity-0 hover:opacity-80 transition"
          >
            <div className="w-10 h-10 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center shadow-lg">
              <ChevronLeft className="w-6 h-6" />
            </div>
          </div>

          <div
            onClick={goToNextPage}
            className="absolute right-0 top-16 bottom-24 w-1/4 cursor-e-resize z-20 flex items-center justify-end pr-2 opacity-0 hover:opacity-80 transition"
          >
            <div className="w-10 h-10 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center shadow-lg">
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>
        </main>
      ) : (
        /* Continuous Webtoon / Vertical Strip Scroll Mode */
        <main className="flex-1 max-w-3xl w-full mx-auto px-2 py-4 space-y-3 pb-32">
          {getAllComicPageUrls(comic).map((url, idx) => (
            <div key={idx} className="relative rounded-xl overflow-hidden bg-secondary shadow-lg">
              <img
                src={url}
                alt={`${comic.title} Page ${idx + 1}`}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur text-[10px] font-bold text-snap">
                Page {idx + 1}
              </span>
            </div>
          ))}
        </main>
      )}

      {/* Floating Bottom Page Navigator Dock */}
      {readingMode === "flip" && (
        <footer className="sticky bottom-0 z-30 bg-black/90 backdrop-blur-xl border-t border-border/80 px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
          {/* Previous Page */}
          <button
            type="button"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev Page</span>
          </button>

          {/* Page Slider / Selector */}
          <div className="flex-1 max-w-xs flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground">{currentPage}</span>
            <input
              type="range"
              min={1}
              max={comic.totalPages}
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              className="w-full accent-[#C5E863] h-1.5 bg-secondary rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-bold text-muted-foreground">{comic.totalPages}</span>
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={goToNextPage}
            disabled={currentPage >= comic.totalPages}
            className="px-4 py-2 rounded-xl bg-snap text-snap-foreground hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1.5 shadow-md transition active:scale-95"
          >
            <span className="hidden sm:inline">Next Page</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </footer>
      )}

      {/* End of Comic celebration & Re-read prompt */}
      {currentPage >= comic.totalPages && readingMode === "flip" && (
        <div className="bg-card/90 border-t border-border p-6 text-center space-y-3 z-30">
          <div className="w-10 h-10 rounded-full bg-snap/20 border border-snap/40 text-snap flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">You finished {comic.title}!</h3>
            <p className="text-xs text-muted-foreground">
              Want to read it over again or jump back to the library?
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Link
              to="/comics"
              className="px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-bold transition"
            >
              Back to Comics
            </Link>
            <button
              type="button"
              onClick={reReadFromStart}
              className="px-5 py-2 rounded-full bg-snap text-snap-foreground text-xs font-bold inline-flex items-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Re-read from beginning</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
