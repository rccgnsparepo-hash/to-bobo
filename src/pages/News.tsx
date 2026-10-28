import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Search,
  Bookmark,
  X,
  Heart,
  MessageCircle,
  Share2,
  BellRing,
  Volume2,
  VolumeX,
  Radio,
  ExternalLink,
  Flame,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import {
  fetchNews,
  NEWS_TABS,
  readerPath,
  triggerTestNewsPush,
  type NewsItem,
  type NewsTab,
} from "@/lib/news";
import { notificationAudio } from "@/lib/notificationAudio";
import { TopFlickersBar } from "@/components/home/TopFlickersBar";

export default function NewsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<NewsTab>("For You");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("flick:news:bookmarks") || "[]");
    } catch {
      return [];
    }
  });
  const [seenAt, setSeenAt] = useState<number>(() =>
    Number(localStorage.getItem("flick:news:seenAt") || 0)
  );
  const [showInbox, setShowInbox] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => notificationAudio.isVoiceEnabled());
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const toggleBookmark = (id: string) => {
    setBookmarks((b) => {
      const next = b.includes(id) ? b.filter((x) => x !== id) : [...b, id];
      localStorage.setItem("flick:news:bookmarks", JSON.stringify(next));
      return next;
    });
  };

  const markSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    localStorage.setItem("flick:news:seenAt", String(now));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchNews(tab)
      .then((data) => {
        if (active) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab]);

  const filtered = q.trim()
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(q.toLowerCase()) ||
          i.source.toLowerCase().includes(q.toLowerCase())
      )
    : items;
  const unread = items.filter((i) => i.ts > seenAt).length;
  const savedItems = items.filter((i) => bookmarks.includes(i.id));

  const share = async (it: NewsItem) => {
    const shareData = { title: it.title, text: `${it.title} — via Flick`, url: it.url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(`${it.title}\n${it.url}`);
        toast.success("Link copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
  };

  const speakHeadline = async (it: NewsItem) => {
    if (speakingId === it.id) {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      return;
    }
    setSpeakingId(it.id);
    toast("Reading headline aloud…");
    // Speak headline only as requested
    await notificationAudio.speak(it.title);
    setSpeakingId(null);
  };

  const repost = async (it: NewsItem) => {
    if (!user) {
      toast.error("Sign in to repost");
      return;
    }
    const content = `${it.title}\n\n${it.url}`;
    const { error } = await supabase
      .from("posts")
      .insert({ author_id: user.id, content, media_type: "text" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Shared to your feed");
    const { data: recipients } = await supabase
      .from("profiles")
      .select("id")
      .neq("id", user.id)
      .limit(500);
    notify({
      kind: "post",
      title: "New on Flick News",
      message: it.title,
      actor: { id: user.id },
      recipients: (recipients ?? []).map((r) => r.id),
      url: "/news",
      data: { news_id: it.id },
      dedupe_id: `news:${it.id}`,
    });
  };

  const heroItem = filtered[0];
  const listItems = filtered.slice(1);

  return (
    <div className="w-full max-w-full overflow-x-hidden pb-36">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <span>News & Sports</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold uppercase tracking-wider">
              63% SPORTS & NAIJA
            </span>
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Realtime sports coverage, Nigerian local reports & global breakthroughs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Voice Readout Toggle in Settings Corner */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              notificationAudio.setVoiceEnabled(next);
              toast.success(
                next
                  ? "Spoken headline readouts enabled"
                  : "Spoken headline readouts muted"
              );
            }}
            aria-label="Toggle voice readout"
            title={voiceEnabled ? "Mute spoken notifications" : "Enable spoken notifications"}
            className={`h-10 px-3 rounded-full border border-border/40 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              voiceEnabled
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-4 h-4" />
                <span className="hidden sm:inline">Voice ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline">Voice Muted</span>
              </>
            )}
          </motion.button>

          {/* Test News Push with sound */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              void triggerTestNewsPush(heroItem?.title);
              toast.success("News Wire push chime triggered!");
            }}
            aria-label="Test Sports push"
            title="Test News Wire Push Notification & Sound"
            className="h-10 px-3 rounded-full bg-secondary hover:bg-secondary/80 border border-border/40 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <BellRing className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-foreground">Push Chime</span>
          </motion.button>

          {/* Bookmarks */}
          <button
            onClick={() => {
              setShowInbox(true);
              markSeen();
            }}
            aria-label="Saved articles"
            className="relative w-10 h-10 rounded-full bg-secondary grid place-items-center"
          >
            <Bookmark className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-snap text-snap-foreground text-[10px] font-bold grid place-items-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Search Input */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sports, NPFL, Super Eagles, Nigerian news, tech…"
            className="bg-transparent flex-1 text-sm focus:outline-none"
          />
        </div>
      </div>

      {/* Global Top Flickers Showcase */}
      <div className="mt-4">
        <TopFlickersBar title="TOP FLICKERS OF THE WEEK • HALL OF FAME" />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-4">
        {NEWS_TABS.map((s) => (
          <motion.button
            key={s}
            whileTap={{ scale: 0.94 }}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
              tab === s
                ? "bg-snap text-snap-foreground shadow-[0_0_15px_rgba(180,255,80,0.4)]"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </motion.button>
        ))}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowInbox(true)}
          className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-secondary text-muted-foreground flex items-center gap-1.5"
        >
          <Bookmark className="w-3.5 h-3.5" /> Saved {bookmarks.length > 0 && `(${bookmarks.length})`}
        </motion.button>
      </div>

      {/* News Feed Stream */}
      <div className="px-4 space-y-4 max-w-4xl mx-auto">
        {loading && (
          <div className="text-center text-muted-foreground py-16">
            <Radio className="w-8 h-8 mx-auto mb-2 text-snap animate-pulse" />
            <p className="text-sm font-semibold">Tuning in to sports & Nigerian local wires…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-sm">No stories found matching your filter.</p>
          </div>
        )}

        {/* Hero Spotlight Story (Bigger UI) */}
        {!loading && heroItem && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-3xl overflow-hidden border border-border bg-gradient-to-b from-card via-card/90 to-background shadow-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-[11px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wider ${
                  heroItem.category === "sports"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : heroItem.category === "nigeria"
                    ? "bg-green-600/20 text-green-300 border border-green-600/40"
                    : heroItem.category === "tech"
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                    : "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                }`}
              >
                {heroItem.category === "sports"
                  ? "🏆 TOP SPORTS HEADLINE"
                  : heroItem.category === "nigeria"
                  ? "🇳🇬 NIGERIA SPOTLIGHT"
                  : heroItem.category === "tech"
                  ? "💻 TECH & INNOVATION"
                  : "🌍 WORLD WIRE"}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => speakHeadline(heroItem)}
                  className={`p-2 rounded-full border transition ${
                    speakingId === heroItem.id
                      ? "bg-snap text-snap-foreground border-snap"
                      : "bg-secondary text-muted-foreground hover:text-foreground border-border"
                  }`}
                  title="Listen to headline"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleBookmark(heroItem.id)}
                  className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground border border-border"
                  title="Save"
                >
                  <Bookmark
                    className={`w-4 h-4 ${
                      bookmarks.includes(heroItem.id) ? "fill-snap text-snap" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            {heroItem.image && (
              <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden mb-4 bg-secondary shadow-md">
                <img
                  src={heroItem.image}
                  alt=""
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                <span className="text-snap">{heroItem.source}</span>
                <span>·</span>
                <span>{new Date(heroItem.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold leading-snug text-foreground">
                {heroItem.title}
              </h2>
              {heroItem.summary && (
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">
                  {heroItem.summary}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
              <Link
                to={readerPath(heroItem)}
                className="text-xs font-bold text-snap flex items-center gap-1 hover:underline"
              >
                <span>Read Full Coverage</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => repost(heroItem)}
                  className="px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/70 flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Repost
                </button>
                <button
                  type="button"
                  onClick={() => share(heroItem)}
                  className="px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/70 flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Regular Magazine List Items */}
        {listItems.map((item, i) => (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className="rounded-3xl border border-border bg-card overflow-hidden hover:border-snap/40 transition-colors shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      item.category === "sports"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : item.category === "nigeria"
                        ? "bg-green-600/20 text-green-300"
                        : item.category === "tech"
                        ? "bg-sky-500/20 text-sky-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}
                  >
                    {item.category === "sports"
                      ? "🏆 Sports"
                      : item.category === "nigeria"
                      ? "🇳🇬 Nigeria"
                      : item.category === "tech"
                      ? "💻 Tech"
                      : "🌍 World"}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">{item.source}</span>
                  <span className="text-xs text-muted-foreground/60">· {new Date(item.ts).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => speakHeadline(item)}
                    className={`p-1.5 rounded-full border transition ${
                      speakingId === item.id
                        ? "bg-snap text-snap-foreground border-snap"
                        : "bg-secondary text-muted-foreground hover:text-foreground border-border"
                    }`}
                    title="Listen to headline"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleBookmark(item.id)}
                    className="p-1.5 rounded-full bg-secondary text-muted-foreground hover:text-foreground border border-border"
                    title="Bookmark"
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 ${
                        bookmarks.includes(item.id) ? "fill-snap text-snap" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <Link to={readerPath(item)}>
                    <h3 className="font-display text-base sm:text-lg font-bold leading-snug text-foreground hover:text-snap transition-colors">
                      {item.title}
                    </h3>
                  </Link>
                  {item.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
                  )}
                </div>

                {item.image && (
                  <div className="w-full sm:w-36 h-40 sm:h-24 rounded-2xl overflow-hidden bg-secondary shrink-0">
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50 text-xs text-muted-foreground">
                <Link to={readerPath(item)} className="text-snap font-bold hover:underline">
                  Read inside →
                </Link>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => repost(item)}
                    className="hover:text-snap flex items-center gap-1 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Repost
                  </button>
                  <button
                    type="button"
                    onClick={() => share(item)}
                    className="hover:text-snap flex items-center gap-1 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </button>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Saved Drawer */}
      <AnimatePresence>
        {showInbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInbox(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end md:items-center justify-center p-0 md:p-4"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-lg bg-card border border-border rounded-t-3xl md:rounded-3xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display font-bold text-lg">Saved Headlines & Bookmarks</h3>
                <button onClick={() => setShowInbox(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {savedItems.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Tap the bookmark on any sports, Nigeria, or tech story to save it for later.
                  </p>
                )}
                {savedItems.map((it) => (
                  <Link
                    key={it.id}
                    to={readerPath(it)}
                    onClick={() => setShowInbox(false)}
                    className="block rounded-2xl bg-secondary/50 border border-border p-3 hover:border-snap/40 transition"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-snap font-bold">
                      {it.source}
                    </div>
                    <div className="font-semibold text-sm mt-1 line-clamp-2">{it.title}</div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}