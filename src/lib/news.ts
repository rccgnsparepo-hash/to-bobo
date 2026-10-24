// Shared news wire used by the News page and the in-app news popup.
export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  image: string | null;
  ts: number;
  summary: string;
};

export const NEWS_TABS = ["For You", "Top", "Tech", "World"] as const;
export type NewsTab = (typeof NEWS_TABS)[number];

export async function fetchHN(): Promise<NewsItem[]> {
  const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
  const j = await res.json();
  return (j.hits ?? []).map(
    (h: { objectID: string; title: string; url: string | null; created_at_i: number; story_text?: string }) => ({
      id: `hn-${h.objectID}`,
      title: h.title,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: "Hacker News",
      image: null,
      ts: h.created_at_i * 1000,
      summary: h.story_text ?? "",
    }),
  );
}

export async function fetchSpaceflight(): Promise<NewsItem[]> {
  const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=20");
  const j = await res.json();
  return (j.results ?? []).map(
    (a: { id: number; title: string; url: string; news_site: string; image_url: string; published_at: string; summary: string }) => ({
      id: `sf-${a.id}`,
      title: a.title,
      url: a.url,
      source: a.news_site,
      image: a.image_url,
      ts: +new Date(a.published_at),
      summary: a.summary,
    }),
  );
}

export async function fetchReddit(sub: string): Promise<NewsItem[]> {
  const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=20`);
  const j = await res.json();
  return (j?.data?.children ?? []).map(
    (c: { data: { id: string; title: string; url: string; subreddit_name_prefixed: string; thumbnail: string; created_utc: number; selftext: string; preview?: { images: { source: { url: string } }[] } } }) => {
      const d = c.data;
      const img =
        d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") ||
        (d.thumbnail?.startsWith("http") ? d.thumbnail : null);
      return {
        id: `rd-${d.id}`,
        title: d.title,
        url: d.url,
        source: d.subreddit_name_prefixed,
        image: img,
        ts: d.created_utc * 1000,
        summary: d.selftext ?? "",
      };
    },
  );
}

export async function fetchNews(tab: NewsTab = "For You"): Promise<NewsItem[]> {
  const loaders: Promise<NewsItem[]>[] =
    tab === "Top"
      ? [fetchHN()]
      : tab === "Tech"
        ? [fetchHN(), fetchReddit("technology")]
        : tab === "World"
          ? [fetchReddit("worldnews")]
          : [fetchHN(), fetchSpaceflight(), fetchReddit("worldnews")];
  const groups = await Promise.all(loaders.map((p) => p.catch(() => [] as NewsItem[])));
  return groups.flat().sort((a, b) => b.ts - a.ts);
}

export function readerPath(it: NewsItem) {
  return `/news/read?u=${encodeURIComponent(it.url)}&t=${encodeURIComponent(it.title)}&s=${encodeURIComponent(it.source)}`;
}

const NEWS_DELIVERED_KEY = "flick:news_delivered_ids";
const NEWS_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

/**
 * Background News Notification Channel.
 * Runs every 4 minutes, fetches top stories, and delivers clean push & in-app alerts.
 */
export function startNewsNotificationChannel(): () => void {
  if (typeof window === "undefined") return () => {};

  const deliverTopNews = async () => {
    try {
      let delivered = new Set<string>();
      try {
        delivered = new Set(JSON.parse(localStorage.getItem(NEWS_DELIVERED_KEY) ?? "[]"));
      } catch {}

      const items = await fetchHN();
      if (!items || items.length === 0) return;

      // Find first undelivered headline
      const fresh = items.find((it) => !delivered.has(it.id));
      if (!fresh) return;

      // Mark delivered
      delivered.add(fresh.id);
      const arr = Array.from(delivered).slice(-60); // keep last 60
      localStorage.setItem(NEWS_DELIVERED_KEY, JSON.stringify(arr));

      // Trigger news wire push notification sound & in-app banner
      const { triggerNotchNotification } = await import("@/components/notifications/NotchNotification");
      const { notificationAudio } = await import("@/lib/notificationAudio");
      void notificationAudio.playNewsWirePushSound(0.95);

      triggerNotchNotification({
        kind: "news",
        title: "📰 Flick News Wire",
        message: fresh.title,
        url: readerPath(fresh),
        actor: { id: "news", handle: "news", display_name: "News Wire" },
      });

      // Browser push notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("📰 Flick News Wire", {
            body: fresh.title,
            icon: "/icon-192.png",
          });
        } catch {}
      }

      // Native Capacitor Android push notification on dedicated "news" channel
      try {
        const { isNativePlatform } = await import("@/lib/native/platform");
        if (isNativePlatform()) {
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          await LocalNotifications.schedule({
            notifications: [
              {
                title: "📰 Flick News Wire",
                body: fresh.title,
                id: Math.floor(Math.random() * 1000000),
                channelId: "news",
                smallIcon: "ic_launcher",
                extra: { url: readerPath(fresh) },
              },
            ],
          });
        }
      } catch (err) {
        console.warn("[newsChannel] Native local notification error:", err);
      }
    } catch (e) {
      console.warn("[newsChannel] Fetch error:", e);
    }
  };

  // Run initial check after 20s
  const initialTimer = setTimeout(() => {
    void deliverTopNews();
  }, 20000);

  // Periodic recurring check every 4 minutes
  const intervalId = setInterval(() => {
    void deliverTopNews();
  }, NEWS_INTERVAL_MS);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
  };
}

/**
 * Manually fires a News Wire Push Notification (with notification sound and notch banner)
 * for testing or instant alerts.
 */
export async function triggerTestNewsPush(headline?: string): Promise<void> {
  const title = headline || "Global Tech & Science Wire: Fresh Breakthroughs Released";
  const { triggerNotchNotification } = await import("@/components/notifications/NotchNotification");
  const { notificationAudio } = await import("@/lib/notificationAudio");

  void notificationAudio.playNewsWirePushSound(1.0);

  triggerNotchNotification({
    kind: "news",
    title: "📰 Flick News Wire",
    message: title,
    url: "/news",
    actor: { id: "news", handle: "news", display_name: "News Wire" },
  });
}

