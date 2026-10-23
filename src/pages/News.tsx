import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Bookmark, X, Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";

type Item = { id: string; title: string; url: string; source: string; image: string | null; ts: number; summary: string };

const SOURCES = ["For You", "Top", "Tech", "World"] as const;

async function fetchHN(): Promise<Item[]> {
  const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
  const j = await res.json();
  return (j.hits ?? []).map((h: { objectID: string; title: string; url: string | null; created_at_i: number; story_text?: string }) => ({
    id: `hn-${h.objectID}`,
    title: h.title,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: "Hacker News",
    image: null,
    ts: h.created_at_i * 1000,
    summary: h.story_text ?? "",
  }));
}

async function fetchSpaceflight(): Promise<Item[]> {
  const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=20");
  const j = await res.json();
  return (j.results ?? []).map((a: { id: number; title: string; url: string; news_site: string; image_url: string; published_at: string; summary: string }) => ({
    id: `sf-${a.id}`,
    title: a.title,
    url: a.url,
    source: a.news_site,
    image: a.image_url,
    ts: +new Date(a.published_at),
    summary: a.summary,
  }));
}

async function fetchReddit(sub: string): Promise<Item[]> {
  const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=20`);
  const j = await res.json();
  return (j?.data?.children ?? []).map((c: { data: { id: string; title: string; url: string; subreddit_name_prefixed: string; thumbnail: string; created_utc: number; selftext: string; preview?: { images: { source: { url: string } }[] } } }) => {
    const d = c.data;
    const img = d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") || (d.thumbnail?.startsWith("http") ? d.thumbnail : null);
    return { id: `rd-${d.id}`, title: d.title, url: d.url, source: d.subreddit_name_prefixed, image: img, ts: d.created_utc * 1000, summary: d.selftext ?? "" };
  });
}

export default function NewsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<typeof SOURCES[number]>("For You");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("flick:news:bookmarks") || "[]"); } catch { return []; }
  });
  const [seenAt, setSeenAt] = useState<number>(() => Number(localStorage.getItem("flick:news:seenAt") || 0));
  const [showInbox, setShowInbox] = useState(false);

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
    setLoading(true);
    const loaders: Promise<Item[]>[] =
      tab === "Top" ? [fetchHN()]
      : tab === "Tech" ? [fetchHN(), fetchReddit("technology")]
      : tab === "World" ? [fetchReddit("worldnews")]
      : [fetchHN(), fetchSpaceflight(), fetchReddit("worldnews")];
    Promise.all(loaders.map((p) => p.catch(() => [] as Item[]))).then((groups) => {
      setItems(groups.flat().sort((a, b) => b.ts - a.ts));
      setLoading(false);
    });
  }, [tab]);

  const filtered = q.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase()) || i.source.toLowerCase().includes(q.toLowerCase()))
    : items;
  const unread = items.filter((i) => i.ts > seenAt).length;
  const savedItems = items.filter((i) => bookmarks.includes(i.id));

  const share = async (it: Item) => {
    const shareData = { title: it.title, text: `${it.title} — via Flick`, url: it.url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(`${it.title}\n${it.url}`); toast.success("Link copied"); }
    } catch { /* user cancelled */ }
  };

  const repost = async (it: Item) => {
    if (!user) { toast.error("Sign in to repost"); return; }
    const content = `${it.title}\n\n${it.url}`;
    const { error } = await supabase.from("posts").insert({ author_id: user.id, content, media_type: "text" });
    if (error) { toast.error(error.message); return; }
    toast.success("Shared to your feed");
    const { data: recipients } = await supabase.from("profiles").select("id").neq("id", user.id).limit(500);
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

  const like = (id: string) => {
    toggleBookmark(id);
    toast.success(bookmarks.includes(id) ? "Removed from saved" : "Saved");
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-tight">News <span className="tape-lime">live</span></h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Stay informed without leaving Flick.</p>
        </div>
        <button onClick={() => { setShowInbox(true); markSeen(); }} aria-label="Saved articles" className="relative w-10 h-10 rounded-full bg-secondary grid place-items-center">
          <Bookmark className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-snap text-snap-foreground text-[10px] font-bold grid place-items-center">{unread > 99 ? "99+" : unread}</span>
          )}
        </button>
      </header>
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news…" className="bg-transparent flex-1 text-sm focus:outline-none" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-4">
        {SOURCES.map((s) => (
          <motion.button key={s} whileTap={{ scale: 0.94 }} onClick={() => setTab(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${tab === s ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"}`}>
            {s}
          </motion.button>
        ))}
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => setShowInbox(true)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap bg-secondary text-muted-foreground flex items-center gap-1.5`}>
          <Bookmark className="w-3.5 h-3.5" /> Saved {bookmarks.length > 0 && `(${bookmarks.length})`}
        </motion.button>
      </div>
      <div className="px-4 pb-40 space-y-3">
        {loading && <div className="text-center text-muted-foreground py-10">Loading the wire…</div>}
        {!loading && filtered.length === 0 && <div className="text-center text-muted-foreground py-10">No headlines yet.</div>}
        {filtered.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
            <div className="relative">
            <Link to={`/news/read?u=${encodeURIComponent(item.url)}&t=${encodeURIComponent(item.title)}&s=${encodeURIComponent(item.source)}`}
              className="block card-glass rounded-3xl overflow-hidden hover:ring-1 hover:ring-snap/40 transition">
              {item.image && (
                <div className="h-40 bg-secondary overflow-hidden">
                  <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-snap font-bold">
                  <span>{item.source}</span>
                  <span className="text-muted-foreground normal-case font-normal">· {new Date(item.ts).toLocaleDateString()}</span>
                </div>
                <h2 className="font-display text-lg mt-1.5 leading-snug">{item.title}</h2>
                {item.summary && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.summary}</p>}
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-snap font-semibold">Read inside →</span>
                </div>
              </div>
            </Link>
              <button onClick={() => toggleBookmark(item.id)} aria-label="Save"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/70 backdrop-blur border border-border grid place-items-center">
                <Bookmark className={`w-4 h-4 ${bookmarks.includes(item.id) ? "fill-snap text-snap" : "text-muted-foreground"}`} />
              </button>
              <div className="flex items-center justify-around px-2 py-2 border-t border-border/60 bg-background/30">
                <button onClick={() => like(item.id)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition ${bookmarks.includes(item.id) ? "text-rose-400" : "text-muted-foreground hover:text-rose-400"}`}>
                  <Heart className={`w-4 h-4 ${bookmarks.includes(item.id) ? "fill-current" : ""}`} /> Like
                </button>
                <button onClick={() => repost(item)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-muted-foreground hover:text-snap transition">
                  <MessageCircle className="w-4 h-4" /> Repost
                </button>
                <button onClick={() => toggleBookmark(item.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition">
                  <Bookmark className={`w-4 h-4 ${bookmarks.includes(item.id) ? "fill-snap text-snap" : ""}`} /> Save
                </button>
                <button onClick={() => share(item)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-muted-foreground hover:text-snap transition">
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {showInbox && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowInbox(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end md:items-center justify-center">
          <motion.div initial={{ y: 40 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-lg bg-card border border-border rounded-t-3xl md:rounded-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display text-lg">Saved & alerts</h3>
              <button onClick={() => setShowInbox(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedItems.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Tap the bookmark on any story to save it for later.</p>}
              {savedItems.map((it) => (
                <Link key={it.id} to={`/news/read?u=${encodeURIComponent(it.url)}&t=${encodeURIComponent(it.title)}&s=${encodeURIComponent(it.source)}`}
                  onClick={() => setShowInbox(false)} className="block card-glass rounded-2xl p-3">
                  <div className="text-[10px] uppercase tracking-wider text-snap font-bold">{it.source}</div>
                  <div className="font-semibold text-sm mt-1 line-clamp-2">{it.title}</div>
                </Link>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}