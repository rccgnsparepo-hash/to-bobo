import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Search,
  RotateCcw,
  Play,
  BookmarkCheck,
  Download,
  CheckCircle2,
  Sparkles,
  WifiOff,
  Flame,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  getAllReadingProgress,
  resetBookProgress,
  type ReadingProgress,
} from "@/lib/comicHistory";
import {
  CURATED_COMICS,
  searchArchiveComics,
  type ComicIssue,
} from "@/lib/comicsData";
import {
  getDownloadedComicsList,
  downloadComicForOffline,
  isComicDownloaded,
} from "@/lib/comicCache";
import { toast } from "sonner";

const GENRES = [
  { id: "all", label: "All Comics" },
  { id: "superhero", label: "Superheroes" },
  { id: "graphic-novel", label: "Graphic Novels" },
  { id: "manga", label: "Manga & Shonen" },
  { id: "webcomic", label: "Webcomics (XKCD)" },
  { id: "offline", label: "Offline Ready" },
] as const;

export default function ComicsPage() {
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [q, setQ] = useState("");
  const [customComics, setCustomComics] = useState<ComicIssue[]>([]);
  const [searchingArchive, setSearchingArchive] = useState(false);
  const [history, setHistory] = useState<ReadingProgress[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedIds, setDownloadedIds] = useState<string[]>(() =>
    getDownloadedComicsList().map((c) => c.id)
  );

  const loadHistory = () => {
    const all = getAllReadingProgress();
    const list = Object.values(all).sort((a, b) => b.lastReadAt - a.lastReadAt);
    setHistory(list);
  };

  useEffect(() => {
    loadHistory();
    const handleProgressUpdate = () => loadHistory();
    const handleOfflineUpdate = () => {
      setDownloadedIds(getDownloadedComicsList().map((c) => c.id));
    };

    window.addEventListener("flick:comic-progress-updated", handleProgressUpdate);
    window.addEventListener("flick:comic-offline-updated", handleOfflineUpdate);
    return () => {
      window.removeEventListener("flick:comic-progress-updated", handleProgressUpdate);
      window.removeEventListener("flick:comic-offline-updated", handleOfflineUpdate);
    };
  }, []);

  // Search Internet Archive when user enters query
  useEffect(() => {
    if (!q.trim()) {
      setCustomComics([]);
      setSearchingArchive(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingArchive(true);
      const results = await searchArchiveComics(q);
      setCustomComics(results);
      setSearchingArchive(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [q]);

  const displayedComics = useMemo(() => {
    let pool = q.trim() && customComics.length > 0 ? customComics : CURATED_COMICS;
    if (q.trim() && customComics.length === 0) {
      pool = CURATED_COMICS.filter(
        (c) =>
          c.title.toLowerCase().includes(q.toLowerCase()) ||
          c.series.toLowerCase().includes(q.toLowerCase()) ||
          c.publisher.toLowerCase().includes(q.toLowerCase())
      );
    }

    if (selectedGenre === "offline") {
      return pool.filter((c) => downloadedIds.includes(c.id));
    }
    if (selectedGenre !== "all") {
      return pool.filter((c) => c.genre === selectedGenre);
    }
    return pool;
  }, [selectedGenre, q, customComics, downloadedIds]);

  const handleRestartComic = (e: React.MouseEvent, comicId: string) => {
    e.preventDefault();
    e.stopPropagation();
    resetBookProgress(comicId);
    loadHistory();
    toast.info("Comic reset to Page 1. Enjoy re-reading!");
  };

  const handleDownloadOffline = async (e: React.MouseEvent, comic: ComicIssue) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloadingId) return;

    setDownloadingId(comic.id);
    setDownloadProgress(0);
    toast.loading(`Downloading ${comic.title} for offline reading...`, { id: "comic-dl" });

    const ok = await downloadComicForOffline(comic, (pct) => {
      setDownloadProgress(pct);
    });

    setDownloadingId(null);
    if (ok) {
      setDownloadedIds(getDownloadedComicsList().map((c) => c.id));
      toast.success(`${comic.title} saved to offline cache!`, { id: "comic-dl" });
    } else {
      toast.error("Could not complete offline download.", { id: "comic-dl" });
    }
  };

  return (
    <div className="min-h-screen pb-32">
      {/* Sticky Header with Search & Filter Pills */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-snap/15 border border-snap/30 text-snap flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="font-display text-2xl tracking-tight text-foreground flex items-center gap-1.5">
                <span>Comic Zone</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Authentic comic scans, graphic novels, manga & offline reading
              </p>
            </div>
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 bg-secondary/80 rounded-full px-3.5 py-2 border border-border/70 focus-within:border-snap/70 transition">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search superheroes, manga, graphic novels, XKCD…"
            className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-muted-foreground text-foreground"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="text-xs text-muted-foreground hover:text-foreground px-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {GENRES.map((g) => {
            const isSelected = selectedGenre === g.id && !q;
            return (
              <button
                key={g.id}
                onClick={() => {
                  setQ("");
                  setSelectedGenre(g.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  isSelected
                    ? "bg-snap text-snap-foreground shadow-sm shadow-snap/20"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Continue Reading Shelf (Where You Stopped & Re-read Over & Over) */}
      {history.length > 0 && !q && (
        <section className="p-4 border-b border-border/80 bg-secondary/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-bold flex items-center gap-2 text-foreground">
              <BookmarkCheck className="w-4 h-4 text-snap" />
              <span>Continue Reading · Where You Stopped</span>
            </h2>
            <span className="text-[11px] text-muted-foreground font-semibold">
              {history.length} in progress
            </span>
          </div>

          <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2">
            {history.map((item) => {
              const isDownloaded = downloadedIds.includes(item.bookId);
              return (
                <div
                  key={item.bookId}
                  className="w-48 shrink-0 bg-card/90 border border-border rounded-2xl p-3 flex flex-col justify-between shadow-md relative group hover:border-snap/50 transition"
                >
                  <Link to={`/comics/${item.bookId}`} className="block">
                    <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-secondary relative mb-2 shadow-sm">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground">
                          <BookOpen className="w-8 h-8 opacity-40" />
                        </div>
                      )}

                      {/* Offline download chip */}
                      {isDownloaded && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur text-[9px] font-bold text-snap flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-snap" />
                          <span>Offline</span>
                        </span>
                      )}

                      {/* Bookmark page indicator */}
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/85 backdrop-blur text-[10px] font-bold text-snap">
                        {item.currentPage ? `Page ${item.currentPage}` : `${item.scrollPercent}%`}
                      </span>
                    </div>

                    <h3 className="font-semibold text-xs truncate text-foreground">{item.title}</h3>
                    <p className="text-[10px] text-muted-foreground truncate">{item.author}</p>
                  </Link>

                  {/* Visual Progress bar */}
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden my-2.5">
                    <div
                      className="bg-snap h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(item.scrollPercent, 4)}%` }}
                    />
                  </div>

                  {/* Actions: Resume & Re-read */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Link
                      to={`/comics/${item.bookId}`}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-snap text-snap-foreground text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm hover:opacity-95 active:scale-95 transition"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Resume</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleRestartComic(e, item.bookId)}
                      className="p-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition active:scale-90"
                      title="Re-read from Page 1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Comic Issues Grid */}
      <div className="p-4">
        {searchingArchive && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded-full border-2 border-snap border-t-transparent animate-spin" />
            <span>Searching 40,000+ comic books in public archives…</span>
          </div>
        )}

        {displayedComics.length === 0 && !searchingArchive ? (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <BookOpen className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-sm">No comics found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {displayedComics.map((comic, i) => {
              const isDownloaded = downloadedIds.includes(comic.id);
              const isDownloading = downloadingId === comic.id;
              const progress = getAllReadingProgress()[comic.id];

              return (
                <motion.div
                  key={comic.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="group relative bg-card/60 border border-border/80 rounded-2xl p-2.5 flex flex-col justify-between hover:border-snap/40 hover:shadow-xl transition"
                >
                  <Link to={`/comics/${comic.id}`} className="block">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-secondary relative shadow-sm group-hover:scale-[1.01] transition duration-200">
                      <img
                        src={comic.coverUrl}
                        alt={comic.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to placeholder if external image fails
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=600&auto=format&fit=crop&q=80";
                        }}
                      />

                      {/* Top badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur text-[10px] font-bold text-white uppercase tracking-wider">
                          {comic.issueNumber || `${comic.totalPages}p`}
                        </span>
                        {isDownloaded && (
                          <span className="px-2 py-0.5 rounded-full bg-snap text-snap-foreground text-[9px] font-bold flex items-center gap-1 shadow">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Saved</span>
                          </span>
                        )}
                      </div>

                      {/* Reading progress banner */}
                      {progress && (
                        <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-xl bg-black/85 backdrop-blur text-[10px] font-bold text-snap flex items-center justify-between shadow">
                          <span>Page {progress.currentPage || 1}</span>
                          <span>{progress.scrollPercent}%</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5">
                      <h3 className="font-semibold text-xs line-clamp-1 text-foreground group-hover:text-snap transition">
                        {comic.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {comic.series} · {comic.year}
                      </p>
                    </div>
                  </Link>

                  {/* Card bottom bar: Read & Offline Download */}
                  <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between gap-1.5">
                    <Link
                      to={`/comics/${comic.id}`}
                      className="flex-1 py-1 px-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-bold text-foreground text-center transition"
                    >
                      Read Now
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleDownloadOffline(e, comic)}
                      disabled={isDownloading}
                      title={isDownloaded ? "Saved offline" : "Download issue for offline reading"}
                      className={`p-1.5 rounded-lg border transition ${
                        isDownloaded
                          ? "bg-snap/20 border-snap/40 text-snap"
                          : "bg-secondary border-border hover:border-snap text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isDownloading ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-snap border-t-transparent animate-spin" />
                      ) : isDownloaded ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-snap" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
