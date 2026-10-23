import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

type NewsItem = { id: string; title: string; url: string; ts: number };

/** Right-rail module: today's headlines. */
export default function RailNews() {
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("https://hn.algolia.com/api/v1/search?tags=front_page")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setNews(
          (j.hits ?? [])
            .slice(0, 5)
            .map(
              (h: { objectID: string; title: string; url: string | null; created_at_i: number }) => ({
                id: h.objectID,
                title: h.title,
                url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
                ts: h.created_at_i * 1000,
              }),
            ),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (news.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-sm mb-2 flex items-center gap-2 text-muted-foreground">
        <TrendingUp className="w-4 h-4 text-snap" /> Today's news
      </h2>
      <div className="card-glass rounded-2xl divide-y divide-border/60">
        {news.map((n) => (
          <Link
            key={n.id}
            to={`/news/read?u=${encodeURIComponent(n.url)}&t=${encodeURIComponent(n.title)}`}
            className="block px-3 py-2.5 hover:bg-secondary/30 min-w-0"
          >
            <div className="text-[13px] font-semibold leading-snug line-clamp-2">{n.title}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {formatDistanceToNowStrict(new Date(n.ts))} ago · Hacker News
            </div>
          </Link>
        ))}
      </div>
      <Link to="/news" className="block text-xs text-snap font-semibold mt-2">
        See all news →
      </Link>
    </section>
  );
}