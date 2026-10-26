import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Download,
  Share2,
  Heart,
  Bookmark,
  Check,
  Sparkles,
  ArrowLeft,
  X,
  ExternalLink,
  ImageIcon,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Flame,
  Send,
  Smile,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CURATED_REAL_WALLPAPERS,
  WALLPAPER_CATEGORIES,
  searchWallpapersFromApi,
  getSavedWallpaperIds,
  toggleSaveWallpaper,
  type WallpaperPin,
} from "@/lib/wallpapersData";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { downloadMedia } from "@/lib/downloadMedia";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { FullEmojiPicker } from "@/components/common/FullEmojiPicker";

export default function WallpapersPage() {
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [wallpapers, setWallpapers] = useState<WallpaperPin[]>(CURATED_REAL_WALLPAPERS);
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedWallpaperIds());
  const [activePin, setActivePin] = useState<WallpaperPin | null>(null);
  const [searching, setSearching] = useState(false);

  // Quick suggestion chips matching the uploaded video & real photo search queries
  const SUGGESTED_TAGS = [
    "Black power art",
    "Swag cartoon",
    "Afro art",
    "Album artwork cover art",
    "Drip cartoon",
    "Anime 4K",
    "Cyberpunk",
    "AMOLED Dark",
    "Supercars",
    "Aesthetic",
  ];

  useEffect(() => {
    const handleSavedUpdate = (e: Event) => {
      const ids = (e as CustomEvent).detail;
      if (ids) setSavedIds(ids);
    };
    window.addEventListener("flick:saved-wallpapers-updated", handleSavedUpdate);
    return () => window.removeEventListener("flick:saved-wallpapers-updated", handleSavedUpdate);
  }, []);

  // Live query real Photo & Wallpaper APIs (WallpaperCave + Wallhaven)
  useEffect(() => {
    let active = true;
    setSearching(true);
    searchWallpapersFromApi(query, selectedCategory).then((results) => {
      if (active) {
        setWallpapers(results);
        setSearching(false);
      }
    });

    return () => {
      active = false;
    };
  }, [query, selectedCategory]);

  const handleToggleSave = (pin: WallpaperPin, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isSaved = toggleSaveWallpaper(pin.id);
    setSavedIds(getSavedWallpaperIds());
    if (isSaved) {
      toast.success(`Saved "${pin.title}" to your Flick collection! ❤️`);
    } else {
      toast.info(`Removed from saved wallpapers`);
    }
  };

  const handleDownload = (pin: WallpaperPin, e?: React.MouseEvent) => {
    e?.stopPropagation();
    void downloadMedia(pin.imageUrl, `${pin.title.toLowerCase().replace(/\s+/g, "-")}-4k.jpg`);
    toast.success("Downloading Ultra-HD wallpaper…");
  };

  const handleSetChatWallpaper = async (pin: WallpaperPin) => {
    if (!user) {
      toast.error("Sign in to set your chat wallpaper");
      return;
    }
    try {
      localStorage.setItem(`flick:chat_wallpaper:${user.id}`, pin.imageUrl);
      window.dispatchEvent(
        new CustomEvent("flick:chat-wallpaper-changed", { detail: { url: pin.imageUrl } })
      );
      toast.success(`Set "${pin.title}" as your Flick chat wallpaper! ✨`);
    } catch {
      toast.error("Failed to set wallpaper");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top Pinterest-style Search Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 space-y-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          {/* Search Input Bar with Pinterest styling */}
          <div className="flex-1 relative flex items-center bg-secondary/80 hover:bg-secondary focus-within:bg-background border border-border focus-within:border-snap/80 rounded-full px-4 py-2.5 transition shadow-inner">
            <Search className="w-5 h-5 text-muted-foreground mr-2.5 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search billions of Pinterest wallpapers, afro art, anime, cyberpunk…"
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/70 text-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-snap/15 text-snap border border-snap/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>4K HD</span>
            </span>
          </div>
        </div>

        {/* Suggestion tags as seen in the uploaded Pinterest video */}
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Ideas:</span>
          </span>
          {SUGGESTED_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setQuery(tag)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 shrink-0 ${
                query.toLowerCase() === tag.toLowerCase()
                  ? "bg-snap text-black shadow-md font-bold"
                  : "bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Categories Bar */}
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {WALLPAPER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition active:scale-95 shrink-0 ${
                selectedCategory === cat
                  ? "bg-foreground text-background shadow"
                  : "bg-card hover:bg-secondary text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Main Pinterest Masonry Grid */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pt-5">
        {wallpapers.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground space-y-3">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/40 stroke-[1.5]" />
            <h3 className="font-bold text-lg text-foreground">No wallpapers found</h3>
            <p className="text-sm">Try searching for "swag", "anime", "amoled", or "cyberpunk".</p>
            <button
              onClick={() => {
                setQuery("");
                setSelectedCategory("All");
              }}
              className="px-4 py-2 rounded-full bg-snap text-black text-xs font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 gap-3 sm:gap-4 [column-fill:_balance] space-y-3 sm:space-y-4">
            {wallpapers.map((pin) => {
              const isSaved = savedIds.includes(pin.id);
              const heightClass =
                pin.aspectRatio === "tall"
                  ? "aspect-[9/16]"
                  : pin.aspectRatio === "wide"
                    ? "aspect-[16/10]"
                    : "aspect-[4/5]";

              return (
                <motion.div
                  key={pin.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setActivePin(pin)}
                  className="break-inside-avoid group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-card border border-border cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Pin Image */}
                  <div className={`w-full ${heightClass} relative overflow-hidden bg-zinc-900`}>
                    <img
                      src={pin.imageUrl}
                      alt={pin.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Dark gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3" />

                    {/* Source & Resolution Pill (Top Left) */}
                    {pin.source && (
                      <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur text-[10px] font-bold text-white shadow flex items-center gap-1 border border-white/15">
                          <span className="w-1.5 h-1.5 rounded-full bg-snap animate-pulse" />
                          <span>{pin.source}</span>
                        </span>
                      </div>
                    )}

                    {/* Red Pinterest-Style Save Button (Top Right) */}
                    <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSave(pin, e)}
                        className={`px-3.5 py-1.5 rounded-full font-bold text-xs shadow-lg transition active:scale-90 flex items-center gap-1.5 ${
                          isSaved
                            ? "bg-zinc-900 text-white border border-white/20"
                            : "bg-[#e60023] hover:bg-[#ad081b] text-white"
                        }`}
                      >
                        {isSaved ? "Saved" : "Save"}
                      </button>
                    </div>

                    {/* Bottom action pills on hover */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex items-center justify-between">
                      <div className="text-white text-xs font-bold drop-shadow truncate pr-2">
                        {pin.title}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDownload(pin, e)}
                          className="w-8 h-8 rounded-full bg-white/90 text-black hover:bg-white flex items-center justify-center shadow transition active:scale-90"
                          title="Download 4K"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pin info footer below card */}
                  <div className="p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        url={pin.creator?.avatar}
                        name={pin.creator?.name || "Creator"}
                        size={22}
                      />
                      <span className="font-semibold text-foreground truncate">
                        {pin.creator?.name || "Community Artist"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                      <span>{pin.likes}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Full Pinterest Pin Detail Modal (Matching the uploaded video) */}
      <AnimatePresence>
        {activePin && (
          <PinterestPinModal
            pin={activePin}
            isSaved={savedIds.includes(activePin.id)}
            onToggleSave={() => handleToggleSave(activePin)}
            onDownload={() => handleDownload(activePin)}
            onSetWallpaper={() => handleSetChatWallpaper(activePin)}
            onClose={() => setActivePin(null)}
            onSelectRelated={(relatedPin) => setActivePin(relatedPin)}
            allWallpapers={wallpapers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Fullscreen Pinterest Wallpaper Pin Detail Modal (Matching Video_2026_10_26-1_1cdda309.webm)
 */
function PinterestPinModal({
  pin,
  isSaved,
  onToggleSave,
  onDownload,
  onSetWallpaper,
  onClose,
  onSelectRelated,
  allWallpapers,
}: {
  pin: WallpaperPin;
  isSaved: boolean;
  onToggleSave: () => void;
  onDownload: () => void;
  onSetWallpaper: () => void;
  onClose: () => void;
  onSelectRelated: (p: WallpaperPin) => void;
  allWallpapers: WallpaperPin[];
}) {
  const [likes, setLikes] = useState(pin.likes);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<string[]>([
    "This wallpaper looks insane on AMOLED screens! 🔥",
    "The lighting and skin tones are unmatched.",
  ]);
  const [commentInput, setCommentInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  const relatedPins = useMemo(() => {
    return allWallpapers
      .filter((w) => w.id !== pin.id && (w.category === pin.category || w.tags.some((t) => pin.tags.includes(t))))
      .slice(0, 8);
  }, [pin, allWallpapers]);

  const handlePostComment = () => {
    if (!commentInput.trim()) return;
    setComments((prev) => [...prev, commentInput.trim()]);
    setCommentInput("");
    toast.success("Thought shared on wallpaper!");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col md:flex-row my-auto"
      >
        {/* Left: High-Res Wallpaper Artwork */}
        <div className="w-full md:w-1/2 bg-black flex items-center justify-center relative p-2 min-h-[360px] md:min-h-[580px] group">
          <img
            src={pin.imageUrl}
            alt={pin.title}
            className="w-full h-full max-h-[560px] object-contain rounded-2xl"
          />

          {/* Quick full-res open button */}
          <a
            href={pin.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-4 left-4 p-2.5 rounded-full bg-black/70 hover:bg-black text-white backdrop-blur transition"
            title="Open raw full-res image"
          >
            <Maximize2 className="w-4 h-4" />
          </a>
        </div>

        {/* Right: Pinterest Pin Details & Actions */}
        <div className="w-full md:w-1/2 flex flex-col justify-between p-5 md:p-6 overflow-y-auto bg-card">
          <div>
            {/* Top Bar: Like count, Share, More, and Red Pinterest Save button */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !liked;
                    setLiked(next);
                    setLikes((l) => (next ? l + 1 : l - 1));
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    liked ? "bg-rose-500/20 text-rose-400" : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                  <span>{likes}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(pin.imageUrl);
                    toast.success("Wallpaper image URL copied to clipboard!");
                  }}
                  className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onDownload}
                  className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              {/* Red Pinterest-Style Save Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleSave}
                  className={`px-5 py-2 rounded-full font-bold text-sm shadow-md transition active:scale-95 ${
                    isSaved
                      ? "bg-zinc-800 text-white border border-white/20"
                      : "bg-[#e60023] hover:bg-[#ad081b] text-white"
                  }`}
                >
                  {isSaved ? "Saved" : "Save"}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Creator Information */}
            <div className="flex items-center gap-3 pt-5">
              <Avatar
                url={pin.creator?.avatar}
                name={pin.creator?.name || "Creator"}
                size={40}
              />
              <div>
                <h4 className="font-bold text-sm text-foreground">
                  {pin.creator?.name || "Community Artist"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {pin.creator?.handle || "@creator"}
                </p>
              </div>
            </div>

            {/* Real Archive & Resolution Badges */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-snap/15 text-snap text-xs font-bold border border-snap/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{pin.source || "Wallpaper Archive"}</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-mono font-semibold border border-border">
                {pin.resolution || "Ultra-HD 4K"}
              </span>
              {pin.views && (
                <span className="text-xs text-muted-foreground font-mono">
                  {pin.views.toLocaleString()} views
                </span>
              )}
            </div>

            {/* Pin Title */}
            <h2 className="font-display font-extrabold text-2xl md:text-3xl text-foreground mt-2 leading-tight">
              {pin.title}
            </h2>

            {/* Tags Pills */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {pin.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-[11px] font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* "Set as Chat Wallpaper" Button (Seamless Flick Integration) */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onSetWallpaper}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-snap text-black text-xs font-bold hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 shadow"
              >
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>Set as Flick Chat Wallpaper</span>
              </button>

              <button
                type="button"
                onClick={onDownload}
                className="py-2.5 px-4 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition flex items-center justify-center gap-2 border border-border"
              >
                <Download className="w-4 h-4" />
                <span>Download 4K</span>
              </button>
            </div>

            {/* Comments / Thoughts Section */}
            <div className="mt-6 pt-5 border-t border-border">
              <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Comments & Reactions ({comments.length})</span>
              </h5>

              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {comments.map((c, i) => (
                  <div key={i} className="text-xs bg-secondary/50 rounded-xl p-2.5 text-foreground">
                    {c}
                  </div>
                ))}
              </div>

              {/* Add a comment */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                  placeholder="Add a comment to share your thoughts…"
                  className="flex-1 bg-secondary/80 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-snap text-foreground"
                />
                <button
                  type="button"
                  onClick={handlePostComment}
                  disabled={!commentInput.trim()}
                  className="p-2 rounded-full bg-snap text-black hover:brightness-110 active:scale-95 transition disabled:opacity-40"
                  title="Post comment"
                >
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* More Like This (Related Pins) */}
            {relatedPins.length > 0 && (
              <div className="mt-6 pt-5 border-t border-border">
                <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  More like this
                </h5>
                <div className="grid grid-cols-4 gap-2">
                  {relatedPins.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onSelectRelated(rel)}
                      className="aspect-[3/4] rounded-xl overflow-hidden hover:opacity-80 transition group relative"
                    >
                      <img src={rel.imageUrl} alt={rel.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-end p-1 text-[9px] text-white font-bold truncate">
                        {rel.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
