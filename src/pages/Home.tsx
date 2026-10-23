import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StoriesBar, type StoryGroup } from "@/components/StoriesBar";
import { StoryViewer } from "@/components/StoryViewer";
import { Composer } from "@/components/Composer";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { motion, AnimatePresence } from "framer-motion";
import { saveFeedOffline, getOfflineFeed } from "@/lib/offlineManager";
import {
  Search,
  Heart,
  TrendingUp,
  UserPlus,
  Check,
  X,
  Sparkles,
  Filter,
  Flame,
  Zap,
  ExternalLink,
  Radio,
  Eye,
  MessageCircle,
  Camera,
  Compass,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { getFollowedUserIds, followUser, unfollowUser, FOLLOWING_EVENT } from "@/lib/follow";
import { toast } from "sonner";

const CHIPS = ["Following", "For You", "Trending", "Recent"] as const;

type NewsItem = { id: string; title: string; url: string; source: string; image: string | null; ts: number };

export default function HomePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetPostId = searchParams.get("post");

  const [posts, setPosts] = useState<PostRow[]>(() => {
    const cached = getOfflineFeed();
    return (cached?.posts as PostRow[]) || [];
  });
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [chip, setChip] = useState<typeof CHIPS[number]>("For You");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<{ id: string; handle: string; display_name: string; avatar_url: string | null }[]>([]);
  const [suggested, setSuggested] = useState<{ id: string; handle: string; display_name: string; avatar_url: string | null; bio: string | null }[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [spotlightPost, setSpotlightPost] = useState<PostRow | null>(null);

  const scrollAttemptedRef = useRef(false);

  // Load followed users
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getFollowedUserIds(user.id).then((ids) => {
      if (alive) setFollowingIds(ids);
    });

    const onFollowUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ userId: string; following: string[] }>;
      if (custom.detail?.following) {
        setFollowingIds(custom.detail.following);
      }
    };
    window.addEventListener(FOLLOWING_EVENT, onFollowUpdate);
    return () => {
      alive = false;
      window.removeEventListener(FOLLOWING_EVENT, onFollowUpdate);
    };
  }, [user?.id]);

  // Load feed posts
  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(60);

      if (!error && data && data.length > 0) {
        const postRows = data as unknown as PostRow[];
        setPosts(postRows);
        saveFeedOffline(postRows);
      } else {
        const cached = getOfflineFeed();
        if (cached?.posts?.length) setPosts(cached.posts as PostRow[]);
      }

      const { data: likes } = await supabase.from("likes").select("post_id");
      const counts: Record<string, number> = {};
      (likes ?? []).forEach((l: { post_id: string }) => {
        counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
      });
      setLikeCounts(counts);
    } catch {
      const cached = getOfflineFeed();
      if (cached?.posts?.length) setPosts(cached.posts as PostRow[]);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Handle direct targetPostId (?post=...) query parameter
  useEffect(() => {
    if (!targetPostId) {
      setSpotlightPost(null);
      return;
    }

    // Check if post already exists in memory
    const existing = posts.find((p) => p.id === targetPostId);
    if (existing) {
      setSpotlightPost(existing);
      // Smooth scroll to element
      setTimeout(() => {
        const el = document.getElementById(`post-${targetPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-snap");
          setTimeout(() => el.classList.remove("ring-2", "ring-snap"), 2500);
        }
      }, 300);
    } else {
      // Fetch directly from database
      supabase
        .from("posts")
        .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
        .eq("id", targetPostId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const row = data as unknown as PostRow;
            setSpotlightPost(row);
            setPosts((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev]));
            setTimeout(() => {
              const el = document.getElementById(`post-${targetPostId}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-snap");
                setTimeout(() => el.classList.remove("ring-2", "ring-snap"), 2500);
              }
            }, 300);
          }
        });
    }
  }, [targetPostId, posts]);

  // Suggested people ("Who to follow")
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, bio")
      .neq("id", user.id)
      .limit(6)
      .then(({ data }) => setSuggested((data ?? []) as typeof suggested));
  }, [user?.id]);

  // Today's news
  useEffect(() => {
    fetch("https://hn.algolia.com/api/v1/search?tags=front_page")
      .then((r) => r.json())
      .then((j) => {
        const items: NewsItem[] = (j.hits ?? []).slice(0, 6).map((h: { objectID: string; title: string; url: string | null; created_at_i: number }) => ({
          id: `hn-${h.objectID}`,
          title: h.title,
          url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
          source: "Hacker News",
          image: null,
          ts: h.created_at_i * 1000,
        }));
        setNews(items);
      })
      .catch(() => {});
  }, []);

  // User search
  useEffect(() => {
    if (!query.trim()) {
      setPeople([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = query.trim().replace(/^@/, "");
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      setPeople((data ?? []) as typeof people);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const searching = query.trim().length > 0;

  // Filter posts based on search query
  const queryFiltered = useMemo(() => {
    if (!searching) return posts;
    const q = query.trim().replace(/^@/, "").toLowerCase();
    return posts.filter(
      (p) =>
        p.author?.handle?.toLowerCase().includes(q) ||
        p.author?.display_name?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
    );
  }, [posts, query, searching]);

  // Follow-filtered posts
  const followFiltered = useMemo(() => {
    if (searching) return queryFiltered;
    if (chip === "Following") {
      // Only show posts from creators the user follows, OR user's own posts
      const filtered = queryFiltered.filter(
        (p) => (user && p.author?.id === user.id) || (p.author?.id && followingIds.includes(p.author.id))
      );
      return filtered;
    }
    return queryFiltered;
  }, [queryFiltered, chip, followingIds, user, searching]);

  // Sorting algorithm based on active chip:
  // - "Following": reverse chronological (newest first from followed accounts)
  // - "Recent": strictly reverse chronological by creation time
  // - "Trending": engagement velocity weighted by recency decay
  // - "For You": discovery algorithm blending engagement score + freshness
  const ordered = useMemo(() => {
    if (chip === "Recent" || chip === "Following") {
      return [...followFiltered].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      );
    }
    if (chip === "Trending") {
      return [...followFiltered].sort((a, b) => {
        const likesA = likeCounts[a.id] ?? 0;
        const likesB = likeCounts[b.id] ?? 0;
        const now = Date.now();
        const ageHoursA = Math.max(0.1, (now - new Date(a.created_at).getTime()) / 3600000);
        const ageHoursB = Math.max(0.1, (now - new Date(b.created_at).getTime()) / 3600000);
        // Engagement velocity: likes / (age in hours + 1)^1.2
        const scoreA = (likesA + 1) / Math.pow(ageHoursA + 1, 1.2);
        const scoreB = (likesB + 1) / Math.pow(ageHoursB + 1, 1.2);
        return scoreB - scoreA;
      });
    }
    // "For You" discovery algorithm
    return [...followFiltered].sort((a, b) => {
      const likesA = likeCounts[a.id] ?? 0;
      const likesB = likeCounts[b.id] ?? 0;
      const now = Date.now();
      const ageHoursA = Math.max(0.1, (now - new Date(a.created_at).getTime()) / 3600000);
      const ageHoursB = Math.max(0.1, (now - new Date(b.created_at).getTime()) / 3600000);
      // Smooth decay giving new posts a healthy boost while surfacing engaging posts
      const scoreA = (likesA * 2 + 3) / Math.pow(ageHoursA + 2, 0.9);
      const scoreB = (likesB * 2 + 3) / Math.pow(ageHoursB + 2, 0.9);
      return scoreB - scoreA;
    });
  }, [followFiltered, chip, likeCounts]);

  // Featured media flicks (top liked flicks with media)
  // FIX: Featured does NOT subtract from main feed! Main feed always renders all matching flicks in order.
  const featured = useMemo(() => {
    return posts
      .filter((p) => p.media_url || p.image_url)
      .sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0))
      .slice(0, 8);
  }, [posts, likeCounts]);
  const popularMedia = featured;

  const toggleFollowUser = async (targetId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to follow flickers");
      return;
    }
    const isCurrentlyFollowing = followingIds.includes(targetId);
    if (isCurrentlyFollowing) {
      const next = await unfollowUser(user.id, targetId);
      setFollowingIds(next);
      toast.info("Unfollowed");
    } else {
      const next = await followUser(user.id, targetId);
      setFollowingIds(next);
      toast.success("Following flicker! Their flicks appear in your Following tab ⚡️");
    }
  };

  return (
    <>
      {/* Target post spotlight alert banner (when navigating from profile/saved with ?post=...) */}
      <AnimatePresence>
        {targetPostId && spotlightPost && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 sm:mx-6 mt-3 p-3 rounded-2xl bg-snap/15 border border-snap/40 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-snap shrink-0" />
              <div className="truncate">
                <span className="font-bold text-foreground">Focused flick</span> by{" "}
                <span className="text-snap font-semibold">@{spotlightPost.author?.handle}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setSearchParams({});
                setSpotlightPost(null);
              }}
              className="px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 font-semibold text-[11px] text-muted-foreground hover:text-foreground shrink-0"
            >
              Clear filter
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stories Bar at top */}
      {!searching && <StoriesBar onView={(groups, index) => setViewer({ groups, index })} />}

      {/* Composer */}
      {!searching && <Composer onPosted={load} />}

      {/* Search Bar Capsule with Filter Button */}
      <div className="px-4 sm:px-6 pt-2 pb-1 relative">
        <div className="flex items-center gap-2 bg-secondary/60 backdrop-blur-xl border border-border/70 rounded-full px-4 py-2 focus-within:border-snap/60 focus-within:ring-1 focus-within:ring-snap/30 shadow-inner">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators, drops, tags, or flicks…"
            className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="h-4 w-px bg-border/60 mx-1" />
          <button
            type="button"
            onClick={() => setChip((prev) => (prev === "Trending" ? "For You" : "Trending"))}
            className="p-1 text-muted-foreground hover:text-snap transition"
            title="Toggle Filter"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {searching && people.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-4 right-4 sm:left-6 sm:right-6 mt-2 card-glass rounded-2xl overflow-hidden z-20 shadow-2xl border border-border/80"
          >
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setQuery("@" + p.handle)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 text-left transition"
              >
                <Avatar url={p.avatar_url} name={p.display_name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate text-foreground">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p.handle}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Category Pills Navigation Strip */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 sm:px-6 py-2.5">
        {CHIPS.map((c) => {
          const isActive = chip === c;
          return (
            <motion.button
              key={c}
              whileTap={{ scale: 0.94 }}
              onClick={() => setChip(c)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                isActive
                  ? "bg-snap text-snap-foreground shadow-md shadow-snap/20"
                  : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              {c === "Trending" && <Flame className="w-3.5 h-3.5" />}
              {c === "For You" && <Sparkles className="w-3.5 h-3.5" />}
              {c === "Following" && <UserPlus className="w-3.5 h-3.5" />}
              {c === "Recent" && <Compass className="w-3.5 h-3.5" />}
              <span>{c}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Today's News */}
      {!searching && news.length > 0 && chip === "News" && (
        <section className="px-5 pt-5 xl:hidden">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-snap" /> Today's News
            </h2>
            <Link to="/news" className="text-xs text-snap font-semibold">
              See all →
            </Link>
          </div>
          <div className="space-y-3">
            {news.slice(0, 3).map((n, i) => (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => window.location.assign(`/news/read?u=${encodeURIComponent(n.url)}&t=${encodeURIComponent(n.title)}`)}
                className="block w-full text-left card-glass rounded-2xl p-3 hover:bg-secondary/40 transition"
              >
                <div className="font-semibold leading-tight text-[15px] line-clamp-2">{n.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1.5">
                  {formatDistanceToNowStrict(new Date(n.ts))} ago · {n.source}
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Featured Carousel (Interactive tap: opens post immediately) */}
      {!searching && featured.length > 0 && (chip === "For You" || chip === "Trending") && (
        <section className="px-5 pt-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg flex items-center gap-1.5">
              <span>Featured flicks</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-snap bg-snap/15 px-2 py-0.5 rounded-full">
                Tap to view
              </span>
            </h2>
            <span className="text-xs text-snap font-semibold">Top liked</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-3">
            {featured.map((p, i) => {
              const src = p.media_url ?? p.image_url!;
              return (
                <motion.article
                  key={`feat-${p.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSearchParams({ post: p.id });
                    const el = document.getElementById(`post-${p.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("ring-2", "ring-snap");
                      setTimeout(() => el.classList.remove("ring-2", "ring-snap"), 2000);
                    }
                  }}
                  className="card-glass rounded-3xl overflow-hidden shrink-0 w-[220px] shadow-xl cursor-pointer group border border-border/80 hover:border-snap/50 transition-all"
                >
                  <div className="relative h-[200px] bg-secondary">
                    {p.media_type === "video" ? (
                      <video src={src} muted loop autoPlay playsInline className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    ) : (
                      <img src={src} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                    )}
                    <span className="absolute top-2 left-2 bg-background/80 backdrop-blur text-[10px] px-2 py-1 rounded-full font-medium shadow-sm">
                      {formatDistanceToNowStrict(new Date(p.created_at))}
                    </span>
                    <span className="absolute top-2 right-2 bg-background/80 backdrop-blur text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-bold text-snap shadow-sm">
                      <Heart className="w-3 h-3 fill-snap" /> {likeCounts[p.id] ?? 0}
                    </span>
                  </div>
                  <div className="p-3 flex items-center gap-2">
                    <Avatar url={p.author?.avatar_url} name={p.author?.display_name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate group-hover:text-snap transition">
                        @{p.author?.handle}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.content || "Flick moment"}</div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>
      )}

      {/* Suggested Flickers ("Who to follow") with interactive Follow toggle */}
      {!searching && suggested.length > 0 && chip === "Following" && ordered.length === 0 && (
        <section className="px-5 pt-4">
          <div className="card-glass rounded-3xl p-6 text-center space-y-3 border border-border">
            <UserPlus className="w-10 h-10 text-snap mx-auto" />
            <h3 className="font-display text-xl">Your Following feed is quiet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Follow creators below to see their flicks and stories right here in your personal feed.
            </p>
            <div className="pt-2 grid sm:grid-cols-2 gap-2 text-left">
              {suggested.slice(0, 4).map((s) => {
                const isFollowing = followingIds.includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-secondary/60 rounded-2xl">
                    <Link to={`/u/${s.handle}`}>
                      <Avatar url={s.avatar_url} name={s.display_name} size={40} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/u/${s.handle}`} className="block font-semibold text-xs truncate">
                        {s.display_name}
                      </Link>
                      <div className="text-[10px] text-muted-foreground truncate">@{s.handle}</div>
                    </div>
                    <button
                      onClick={(e) => toggleFollowUser(s.id, e)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${
                        isFollowing
                          ? "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          : "bg-snap text-snap-foreground hover:opacity-90"
                      }`}
                    >
                      {isFollowing ? "Following" : "+ Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Feed */}
      <section className="px-2 lg:px-0 pt-4 pb-20">
        <div className="flex items-baseline justify-between px-3 lg:px-1 mb-2">
          <h2 className="font-display text-lg">
            {searching
              ? `Results for "${query}"`
              : chip === "Following"
              ? "Following feed"
              : chip === "Recent"
              ? "Just posted"
              : chip === "Trending"
              ? "Trending now"
              : "For You"}
          </h2>
          <span className="text-xs text-muted-foreground">{ordered.length} flick{ordered.length === 1 ? "" : "s"}</span>
        </div>

        {ordered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            {searching ? "Nothing here yet." : chip === "Following" ? "Follow flickers above to see their posts." : "No flicks yet. Be the first."}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-2 2xl:grid-cols-3 lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          {ordered.map((p) => (
            <div key={p.id} id={`post-${p.id}`} className={targetPostId === p.id ? "ring-2 ring-snap rounded-3xl" : ""}>
              <PostCard post={p} />
            </div>
          ))}
        </div>
      </section>

      <StoryViewer groups={viewer?.groups ?? null} startIndex={viewer?.index ?? 0} onClose={() => setViewer(null)} />
    </>
  );
}
