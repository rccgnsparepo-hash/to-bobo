import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import {
  Bookmark,
  Search,
  Trash2,
  FolderPlus,
  ArrowLeft,
  X,
  AlertCircle,
  CheckSquare,
  Square,
  Lock,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  getBookmarks,
  getBookmarkFolders,
  createBookmarkFolder,
  bulkRemoveBookmarks,
  toggleBookmark,
  type BookmarkItem,
  type BookmarkFolder,
} from "@/lib/bookmarks/bookmarkService";
import { PostCard } from "@/components/PostCard";

export default function BookmarksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Bulk select mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Folder modal
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bms, flds] = await Promise.all([
        getBookmarks(user.id),
        getBookmarkFolders(user.id),
      ]);
      setBookmarks(bms);
      setFolders(flds);
    } catch {
      toast.error("Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleBookmarkChange = () => loadData();
    window.addEventListener("flick:bookmarks-changed", handleBookmarkChange);
    return () => window.removeEventListener("flick:bookmarks-changed", handleBookmarkChange);
  }, [user]);

  // Filtered by active folder & search query within saved
  const filteredBookmarks = useMemo(() => {
    let result = bookmarks;

    if (activeFolder !== "all") {
      result = result.filter((b) => b.folder_id === activeFolder);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.post?.content?.toLowerCase().includes(q) ||
          b.post?.author?.handle?.toLowerCase().includes(q) ||
          b.post?.author?.display_name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [bookmarks, activeFolder, query]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFolderName.trim()) return;
    const fld = await createBookmarkFolder(user.id, newFolderName);
    setFolders((prev) => [...prev, fld]);
    setNewFolderName("");
    setFolderModalOpen(false);
    toast.success(`Created folder "${fld.name}"`);
  };

  const handleToggleSelect = (postId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredBookmarks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBookmarks.map((b) => b.post_id)));
    }
  };

  const handleBulkRemove = async () => {
    if (!user || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await bulkRemoveBookmarks(user.id, ids);
    setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.post_id)));
    setSelectedIds(new Set());
    setBulkMode(false);
    toast.success(`Removed ${ids.length} bookmark${ids.length > 1 ? "s" : ""}`);
  };

  const handleRemoveSingle = async (postId: string) => {
    if (!user) return;
    await toggleBookmark(user.id, postId);
    setBookmarks((prev) => prev.filter((b) => b.post_id !== postId));
    toast.info("Bookmark removed");
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen pb-32 px-4 sm:px-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/80 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-snap fill-snap" />
              <span>Bookmarks</span>
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Strictly private · Only you can see saved flicks</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {bookmarks.length > 0 && (
            <button
              onClick={() => {
                setBulkMode((v) => !v);
                setSelectedIds(new Set());
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                bulkMode
                  ? "bg-secondary text-foreground border border-border"
                  : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {bulkMode ? "Cancel" : "Select"}
            </button>
          )}
          <button
            onClick={() => setFolderModalOpen(true)}
            aria-label="Create collection folder"
            className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 grid place-items-center text-muted-foreground hover:text-foreground transition"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Search within Bookmarks */}
      <div className="pt-4 pb-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search within saved flicks…"
            className="w-full bg-secondary/70 focus:bg-background border border-border focus:border-snap rounded-full pl-10 pr-9 py-2 text-xs text-foreground focus:outline-none transition"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Folders Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2">
        <button
          onClick={() => setActiveFolder("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeFolder === "all"
              ? "bg-snap text-snap-foreground shadow-sm shadow-snap/20"
              : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60"
          }`}
        >
          All ({bookmarks.length})
        </button>
        {folders.map((f) => {
          const count = bookmarks.filter((b) => b.folder_id === f.id).length;
          const isActive = activeFolder === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                isActive
                  ? "bg-snap text-snap-foreground shadow-sm shadow-snap/20"
                  : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color || "#b8ff00" }} />
              <span>{f.name}</span>
              {count > 0 && <span className="opacity-70 font-mono text-[10px]">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Bulk Action Strip */}
      {bulkMode && (
        <div className="my-3 p-3 rounded-2xl bg-secondary/80 border border-border flex items-center justify-between">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-xs font-semibold text-foreground"
          >
            {selectedIds.size === filteredBookmarks.length ? (
              <CheckSquare className="w-4 h-4 text-snap" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground" />
            )}
            <span>Select all ({filteredBookmarks.length})</span>
          </button>
          <button
            onClick={handleBulkRemove}
            disabled={selectedIds.size === 0}
            className="px-3.5 py-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove ({selectedIds.size})</span>
          </button>
        </div>
      )}

      {/* Bookmarks List */}
      <div className="pt-2 space-y-4">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground text-xs">Loading saved flicks…</div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-secondary/70 grid place-items-center mx-auto text-2xl">
              🔖
            </div>
            <h3 className="font-display font-bold text-base text-foreground">No bookmarks yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Save interesting flicks, tutorials, and moments to your private collection by tapping the bookmark icon.
            </p>
          </div>
        ) : (
          filteredBookmarks.map((bm) => {
            const isSelected = selectedIds.has(bm.post_id);

            // Handle deleted / blocked author posts gracefully
            if (bm.isUnavailable || !bm.post) {
              return (
                <div
                  key={bm.id}
                  className="p-4 rounded-3xl bg-secondary/30 border border-dashed border-border/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>This post is no longer available.</span>
                  </div>
                  <button
                    onClick={() => handleRemoveSingle(bm.post_id)}
                    className="px-3 py-1 rounded-full bg-secondary hover:bg-destructive/20 hover:text-destructive text-muted-foreground font-semibold text-[11px] border border-border transition"
                  >
                    Remove
                  </button>
                </div>
              );
            }

            return (
              <div key={bm.id} className="relative group">
                {bulkMode && (
                  <button
                    type="button"
                    onClick={() => handleToggleSelect(bm.post_id)}
                    className="absolute top-4 left-2 z-10 p-1 rounded-md bg-black/60 backdrop-blur"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-snap" />
                    ) : (
                      <Square className="w-5 h-5 text-white" />
                    )}
                  </button>
                )}
                <div className={bulkMode && isSelected ? "ring-2 ring-snap rounded-3xl" : ""}>
                  <PostCard post={bm.post} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {folderModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create collection folder"
            onClick={() => setFolderModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border/80">
                <h3 className="font-display font-bold text-base text-foreground">
                  New Bookmark Folder
                </h3>
                <button onClick={() => setFolderModalOpen(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleCreateFolder} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Folder name
                  </label>
                  <input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Design Inspiration, Coding, Laughs"
                    className="w-full bg-secondary px-3.5 py-2.5 rounded-2xl text-xs border border-border focus:outline-none focus:ring-1 focus:ring-snap text-foreground"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFolderModalOpen(false)}
                    className="flex-1 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newFolderName.trim()}
                    className="flex-1 py-2 rounded-full bg-snap text-snap-foreground text-xs font-bold hover:opacity-90 disabled:opacity-40 shadow-sm"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
