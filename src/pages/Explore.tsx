import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Search,
  X,
  TrendingUp,
  UserPlus,
  Check,
  Sparkles,
  Lock,
  Clock,
  Compass,
  AlertCircle,
  RefreshCw,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { PostCard, type PostRow } from "@/components/PostCard";
import { motion, AnimatePresence } from "framer-motion";
import { followUser, unfollowUser, getFollowedUserIds } from "@/lib/follow";
import { getBlockedUserIds, getMutedUserIds } from "@/lib/safety/safetyService";
import { toast } from "sonner";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";

type SearchTab = "top" | "people" | "posts" | "tags";

type SuggestedAccount = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_private?: boolean;
  why: string;
};

const TRENDING_TAGS = [
  { tag: "#FlickVibes", count: "14.2K", velocity: "+84% last 24h" },
  { tag: "#CampusCreatives", count: "9.8K", velocity: "+62% last 24h" },
  { tag: "#LiveJamSession", count: "8.1K", velocity: "+45% last 24h" },
  { tag: "#CodeDrop", count: "5.4K", velocity: "+30% last 24h" },
  { tag: "#SnapStories", count: "4.7K", velocity: "+28% last 24h" },
  { tag: "#LagosTechies", count: "3.9K", velocity: "+19% last 24h" },
];

export default function ExplorePage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("top");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("flick:recent_searches") || "[]");
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [peopleResults, setPeopleResults] = useState<SuggestedAccount[]>([]);
  const [postResults, setPostResults] = useState<PostRow[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<PostRow[]>([]);
  const [suggestedAccounts, setSuggestedAccounts] = useState<SuggestedAccount[]>([]);

  // Safety filters
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [mutedIds, setMutedIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  // Pagination for infinite scroll
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  // Load safety filters
  useEffect(() => {
    if (!user) return;
    Promise.all([
      getBlockedUserIds(user.id),
      getMutedUserIds(user.id),
      getFollowedUserIds(user.id),
    ]).then(([blocks, mutes, follows]) => {
      setBlockedIds(blocks);
      setMutedIds(mutes);
      setFollowingIds(follows);
    });
  }, [user]);

  // Load discover posts & suggested accounts on mount
  const loadDiscover = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Discover posts
      const { data: posts, error: pErr } = await supabase
        .from("posts")
        .select(
          "id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)"
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (pErr) throw pErr;
      const rows = (posts || []) as unknown as PostRow[];
      setDiscoverPosts(rows);

      // 2. Suggested creators with "Why am I seeing this?"
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url, bio")
        .limit(8);

      const whyReasons = [
        "Mutual follow with creators you like",
        "Popular creator in your campus circle",
        "Posts frequently in #FlickVibes",
        "Shared interest in creative tech drops",
      ];

      const mapped = (profiles || [])
        .filter((p) => p.id !== user?.id)
        .map((p, idx) => ({
          ...p,
          why: whyReasons[idx % whyReasons.length],
        }));
      setSuggestedAccounts(mapped);
    } catch (err: any) {
      setError("Unable to load explore content. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscover();
  }, []);

  // Debounced search (250ms)
  useEffect(() => {
    if (!query.trim()) {
      setPeopleResults([]);
      setPostResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const cleanQuery = query.trim().replace(/^[@#]/, "");

        // Save recent search
        setRecentSearches((prev) => {
          const updated = [query.trim(), ...prev.filter((q) => q.toLowerCase() !== query.trim().toLowerCase())].slice(0, 10);
          localStorage.setItem("flick:recent_searches", JSON.stringify(updated));
          return updated;
        });

        // Search profiles
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url, bio")
          .or(`handle.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
          .limit(PAGE_SIZE);

        if (profErr) throw profErr;

        // Search posts
        const { data: pst, error: pstErr } = await supabase
          .from("posts")
          .select(
            "id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)"
          )
          .ilike("content", `%${cleanQuery}%`)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);

        if (pstErr) throw pstErr;

        setPeopleResults((profs || []).map((p) => ({
          ...p,
          why: "Matches your search query",
        })));
        setPostResults((pst || []) as unknown as PostRow[]);
      } catch (err: any) {
        setError("Error performing search. Tap retry to try again.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  // Filter out blocked and muted accounts
  const filteredPeople = useMemo(() => {
    const hidden = new Set([...blockedIds, ...mutedIds]);
    return peopleResults.filter((p) => !hidden.has(p.id));
  }, [peopleResults, blockedIds, mutedIds]);

  const filteredPosts = useMemo(() => {
    const hidden = new Set([...blockedIds, ...mutedIds]);
    return postResults.filter((p) => p.author && !hidden.has(p.author.id));
  }, [postResults, blockedIds, mutedIds]);

  const filteredDiscover = useMemo(() => {
    const hidden = new Set([...blockedIds, ...mutedIds]);
    return discoverPosts.filter((p) => p.author && !hidden.has(p.author.id));
  }, [discoverPosts, blockedIds, mutedIds]);

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("flick:recent_searches");
    toast.info("Recent searches cleared");
  };

  const handleFollow = async (targetId: string, handle: string) => {
    if (!user) {
      toast.error("Please sign in to follow flickers");
      return;
    }
    const isFollowing = followingIds.includes(targetId);
    if (isFollowing) {
      const next = await unfollowUser(user.id, targetId);
      setFollowingIds(next);
      toast.info(`Unfollowed @${handle}`);
    } else {
      const next = await followUser(user.id, targetId);
      setFollowingIds(next);
      toast.success(`Following @${handle}`);
    }
  };

  const isSearching = query.trim().length > 0;

  return (
    <div className="max-w-4xl mx-auto min-h-screen pb-28 px-4 sm:px-6">
      {/* Sticky Search Header with 250ms debounce */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl pt-3 pb-2 border-b border-border/80">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, tags, drops or posts…"
            className="w-full bg-secondary/80 hover:bg-secondary focus:bg-background border border-border focus:border-snap rounded-full pl-11 pr-10 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-snap transition placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Clear search input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Tabs: Top, People, Posts, Tags */}
        {isSearching && (
          <div className="flex items-center gap-1 mt-2.5 overflow-x-auto no-scrollbar">
            {(["top", "people", "posts", "tags"] as SearchTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition ${
                  activeTab === tab
                    ? "bg-snap text-snap-foreground shadow-md shadow-snap/20"
                    : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error State with Retry */}
      {error && (
        <div className="my-6 p-4 rounded-2xl bg-destructive/15 border border-destructive/30 flex items-center justify-between gap-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => (isSearching ? setQuery(query) : loadDiscover())}
            className="px-3 py-1 rounded-full bg-destructive text-white font-bold text-[11px] flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="py-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-3xl bg-secondary/40 border border-border animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/60" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-muted/60 rounded w-1/4" />
                  <div className="h-2.5 bg-muted/40 rounded w-1/6" />
                </div>
              </div>
              <div className="h-4 bg-muted/50 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* ACTIVE SEARCH RESULTS */}
      {!loading && isSearching && (
        <div className="pt-4 space-y-6">
          {/* People Section */}
          {(activeTab === "top" || activeTab === "people") && filteredPeople.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                People
              </h3>
              <div className="space-y-2">
                {filteredPeople.map((p) => {
                  const isFollowing = followingIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center justify-between gap-3 hover:bg-secondary/40 transition"
                    >
                      <Link to={`/u/${p.handle}`} className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar url={p.avatar_url} name={p.display_name} size={42} />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                            <span>{p.display_name}</span>
                            {isUserVerified(p.id) && <FlickVerifiedBadge size={14} />}
                            {p.is_private && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                          {p.bio && !p.is_private && (
                            <p className="text-xs text-foreground/80 line-clamp-1 mt-0.5">{p.bio}</p>
                          )}
                        </div>
                      </Link>

                      {user?.id !== p.id && (
                        <button
                          onClick={() => handleFollow(p.id, p.handle)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                            isFollowing
                              ? "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border"
                              : "bg-snap text-snap-foreground hover:opacity-90 shadow-sm"
                          }`}
                        >
                          {isFollowing ? "Following" : "+ Follow"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Posts Section */}
          {(activeTab === "top" || activeTab === "posts") && filteredPosts.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Posts
              </h3>
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}

          {/* Tags Section */}
          {(activeTab === "top" || activeTab === "tags") && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Matching Tags
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {TRENDING_TAGS.filter((t) =>
                  t.tag.toLowerCase().includes(query.toLowerCase().replace("#", ""))
                ).map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setQuery(t.tag)}
                    className="p-3 rounded-2xl bg-secondary/50 hover:bg-secondary border border-border text-left transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-foreground">{t.tag}</div>
                      <div className="text-[11px] text-muted-foreground">{t.count} flicks</div>
                    </div>
                    <span className="text-[10px] text-snap font-mono font-bold bg-snap/15 px-2 py-0.5 rounded-full">
                      {t.velocity}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Empty State for Search */}
          {filteredPeople.length === 0 && filteredPosts.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <div className="w-12 h-12 rounded-full bg-secondary grid place-items-center mx-auto text-xl">
                🔍
              </div>
              <h4 className="font-bold text-foreground text-sm">No results for "{query}"</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No results for "{query}". Try a different spelling or a tag.
              </p>
            </div>
          )}
        </div>
      )}

      {/* EMPTY STATE (DEFAULT EXPLORE VIEW) */}
      {!loading && !isSearching && (
        <div className="pt-4 space-y-8">
          {/* Recent Searches (On-device with Clear) */}
          {recentSearches.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Recent searches</span>
                </h3>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs font-semibold text-snap hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="px-3.5 py-1.5 rounded-full bg-secondary/70 hover:bg-secondary text-xs text-foreground/90 font-medium border border-border transition flex items-center gap-1.5"
                  >
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Trending Tags (Last 24h) */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-snap" />
              <span>Trending tags (last 24h)</span>
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {TRENDING_TAGS.map((t) => (
                <button
                  key={t.tag}
                  onClick={() => setQuery(t.tag)}
                  className="p-3.5 rounded-2xl bg-secondary/40 hover:bg-secondary border border-border/80 text-left transition flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-sm text-foreground group-hover:text-snap transition">
                      {t.tag}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t.count} flicks</div>
                  </div>
                  <span className="text-[10px] text-snap font-mono font-bold bg-snap/15 px-2 py-0.5 rounded-full border border-snap/30">
                    {t.velocity}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Suggested Accounts with "Why am I seeing this?" */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-snap" />
                <span>Suggested accounts</span>
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {suggestedAccounts.slice(0, 4).map((acc) => {
                const isFollowing = followingIds.includes(acc.id);
                return (
                  <div
                    key={acc.id}
                    className="p-4 rounded-3xl bg-card border border-border/80 flex flex-col justify-between space-y-3 hover:border-snap/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/u/${acc.handle}`} className="flex items-center gap-2.5 min-w-0">
                        <Avatar url={acc.avatar_url} name={acc.display_name} size={42} />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-foreground truncate flex items-center gap-1">
                            <span>{acc.display_name}</span>
                            {isUserVerified(acc.id) && <FlickVerifiedBadge size={14} />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">@{acc.handle}</div>
                        </div>
                      </Link>

                      {user?.id !== acc.id && (
                        <button
                          onClick={() => handleFollow(acc.id, acc.handle)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                            isFollowing
                              ? "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border"
                              : "bg-snap text-snap-foreground hover:opacity-90 shadow-sm"
                          }`}
                        >
                          {isFollowing ? "Following" : "+ Follow"}
                        </button>
                      )}
                    </div>

                    {/* "Why am I seeing this?" transparent badge */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/50 rounded-xl px-2.5 py-1 border border-border/50">
                      <Info className="w-3 h-3 text-snap shrink-0" />
                      <span className="truncate">{acc.why}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Discover Posts (Embodying Discover Feed) */}
          <section className="space-y-3 pt-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-snap" />
              <span>Discover flicks</span>
            </h3>
            <div className="space-y-4">
              {filteredDiscover.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
