// iOS-style news banner: surfaces a fresh headline on a timer, and fires a
// system notification when the app is in the background so people come back.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Newspaper, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchNews, readerPath, type NewsItem } from "@/lib/news";
import { useAppPrefs } from "@/lib/appPrefs";

const SEEN_KEY = "flick:news-seen";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  const next = [...readSeen(), id].slice(-200);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export function NewsPopup() {
  const { prefs } = useAppPrefs();
  const navigate = useNavigate();
  const [item, setItem] = useState<NewsItem | null>(null);
  const queue = useRef<NewsItem[]>([]);
  const hideTimer = useRef<number | null>(null);

  // Keep a rolling queue of unseen headlines.
  useEffect(() => {
    if (!prefs.newsPopups) return;
    let cancelled = false;
    const refill = async () => {
      const items = await fetchNews("For You").catch(() => [] as NewsItem[]);
      if (cancelled) return;
      const seen = new Set(readSeen());
      queue.current = items.filter((i) => !seen.has(i.id));
    };
    void refill();
    const id = window.setInterval(refill, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [prefs.newsPopups]);

  // Fire a headline on the configured cadence.
  useEffect(() => {
    if (!prefs.newsPopups) return;
    const every = Math.max(10, prefs.newsIntervalSec) * 1000;
    const id = window.setInterval(() => {
      const next = queue.current.shift();
      if (!next) return;
      markSeen(next.id);

      if (document.visibilityState === "hidden") {
        if (!prefs.newsExternal) return;
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        try {
          const n = new Notification(next.title, {
            body: next.source,
            icon: next.image ?? "/favicon.svg",
            tag: next.id,
          });
          n.onclick = () => {
            window.focus();
            window.dispatchEvent(
              new CustomEvent("flick:push-navigate", { detail: { url: readerPath(next) } }),
            );
            n.close();
          };
        } catch {
          /* noop */
        }
        return;
      }

      setItem(next);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setItem(null), 7000);
    }, every);
    return () => {
      window.clearInterval(id);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [prefs.newsPopups, prefs.newsIntervalSec, prefs.newsExternal]);

  const open = () => {
    if (!item) return;
    const path = readerPath(item);
    setItem(null);
    navigate(path);
  };

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, i) => i.offset.y < -40 && setItem(null)}
          className="fixed top-3 inset-x-3 z-[80] lg:left-auto lg:right-6 lg:w-[380px]"
        >
          <button
            onClick={open}
            className="w-full text-left card-glass rounded-3xl p-3 flex items-center gap-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]"
          >
            <span className="w-10 h-10 rounded-2xl bg-secondary grid place-items-center overflow-hidden shrink-0">
              {item.image ? (
                <img src={item.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <Newspaper className="w-5 h-5" />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                {item.source}
              </span>
              <span className="block text-sm font-semibold leading-snug line-clamp-2">{item.title}</span>
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setItem(null);
              }}
              className="p-1 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
