import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Eye,
  Search,
  Sparkles,
  Radio,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { formatDistanceToNowStrict } from "date-fns";
import { Link } from "react-router-dom";
import type { StoryViewsData } from "@/lib/storyViews";

function formatRealtimeViewedAt(viewedAt: string, storyCreatedAt: string): string {
  try {
    const vTime = new Date(viewedAt).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - vTime) / 1000));

    if (diffSec < 45) {
      return "Just now";
    }
    if (diffSec < 3600) {
      return `${Math.floor(diffSec / 60)}m ago`;
    }
    if (diffSec < 86400) {
      return `${Math.floor(diffSec / 3600)}h ago`;
    }
    // Fall back to date-fns
    return `${formatDistanceToNowStrict(new Date(viewedAt))} ago`;
  } catch {
    return "Recently";
  }
}

export function StoryViewersOverlay({
  open,
  onClose,
  viewsData,
  storyCaption,
  storyMediaUrl,
  storyCreatedAt,
  storyAuthorId,
}: {
  open: boolean;
  onClose: () => void;
  viewsData: StoryViewsData;
  storyCaption?: string | null;
  storyMediaUrl?: string;
  storyCreatedAt: string;
  storyAuthorId?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "reactions">("all");

  const storyTime = new Date(storyCreatedAt).getTime();

  // Real viewers only — never include the author, seed IDs, or chronologically impossible timestamps
  const realViewers = (viewsData.viewers || []).filter((v) => {
    if (!v || !v.id) return false;
    if (v.id.startsWith("u-")) return false; // remove decoy
    if (storyAuthorId && v.id === storyAuthorId) return false; // remove author
    if (storyTime > 0 && v.viewed_at) {
      const vTime = new Date(v.viewed_at).getTime();
      if (vTime < storyTime - 10000) return false; // strictly discard old views from prior stories
    }
    return true;
  });

  const filteredViewers = realViewers.filter((v) => {
    if (activeTab === "reactions" && !v.reaction) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      v.display_name.toLowerCase().includes(q) ||
      v.handle.toLowerCase().includes(q)
    );
  });

  const realCount = realViewers.length;
  const totalReactionsCount = realViewers.filter((v) => Boolean(v.reaction)).length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center pointer-events-auto">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 400) {
                onClose();
              }
            }}
            className="relative w-full max-w-lg bg-[#0e0e11] border-t border-white/15 rounded-t-[32px] overflow-hidden flex flex-col max-h-[82dvh] shadow-2xl z-10"
          >
            {/* Grab handle indicator */}
            <div className="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-white/25" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-snap/15 border border-snap/30 flex items-center justify-center text-snap">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold text-white tracking-tight">
                      Story Viewers
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-snap text-black text-xs font-black">
                      {realCount}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Realtime
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50">
                    Seen by {realCount} {realCount === 1 ? "person" : "people"} · Posted {formatDistanceToNowStrict(new Date(storyCreatedAt))} ago
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition"
                aria-label="Close viewers overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Story Mini Summary Card */}
            <div className="mx-5 my-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
              {storyMediaUrl && (
                <div className="w-12 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10">
                  <img
                    src={storyMediaUrl}
                    alt="Story preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white/90 truncate">
                  {storyCaption || "Story Moment"}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-[11px] text-snap font-bold">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{realCount} Views</span>
                  </div>
                  {totalReactionsCount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-pink-400 font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{totalReactionsCount} Reactions</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reaction Badges Stack */}
              {totalReactionsCount > 0 && (
                <div className="flex items-center gap-1 shrink-0 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                  {Object.entries(viewsData.reactions || {}).map(([emoji, count]) => (
                    <span key={emoji} className="text-xs flex items-center gap-0.5">
                      <span>{emoji}</span>
                      <span className="text-[10px] text-white/70 font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Tabs & Search */}
            <div className="px-5 space-y-2.5 mb-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    activeTab === "all"
                      ? "bg-snap text-black border-snap"
                      : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>All Viewers ({realCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("reactions")}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    activeTab === "reactions"
                      ? "bg-snap text-black border-snap"
                      : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reactions ({totalReactionsCount})</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search viewers by name or @handle…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-snap transition"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Viewers List */}
            <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-white/5">
              {filteredViewers.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs px-6">
                  {query ? (
                    `No viewers matching "${query}"`
                  ) : activeTab === "reactions" ? (
                    "No reactions on this story yet."
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/30">
                        <Radio className="w-5 h-5 text-snap" />
                      </div>
                      <p className="font-medium text-white/80">No views yet</p>
                      <p className="text-[11px] text-white/40 max-w-xs mx-auto">
                        When other flickers watch your story, their real-time view will appear here instantly.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                filteredViewers.map((viewer) => {
                  const timeLabel = formatRealtimeViewedAt(viewer.viewed_at, storyCreatedAt);
                  const isJustNow = timeLabel === "Just now";

                  return (
                    <div
                      key={viewer.id}
                      className="py-2.5 flex items-center justify-between gap-3 group hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition"
                    >
                      {/* User Profile Info */}
                      <Link
                        to={`/u/${viewer.handle}`}
                        onClick={onClose}
                        className="flex items-center gap-3 min-w-0 flex-1"
                      >
                        <div className="relative shrink-0">
                          <Avatar
                            url={viewer.avatar_url}
                            name={viewer.display_name}
                            size={40}
                          />
                          {viewer.reaction && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black/90 border border-white/20 flex items-center justify-center text-xs shadow-md">
                              {viewer.reaction}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-white truncate group-hover:text-snap transition">
                              {viewer.display_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/50 truncate flex items-center gap-1.5">
                            <span>@{viewer.handle}</span>
                            <span>·</span>
                            <span className={isJustNow ? "text-emerald-400 font-bold flex items-center gap-1" : ""}>
                              {isJustNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              {timeLabel}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
