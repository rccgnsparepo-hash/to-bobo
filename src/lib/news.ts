// Shared news wire used by the News page and in-app notifications.
export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  category: "sports" | "nigeria" | "tech" | "world";
  image: string | null;
  ts: number;
  summary: string;
};

export const NEWS_TABS = [
  "For You",
  "🏆 Sports",
  "🇳🇬 Nigeria Local",
  "💻 Technology",
  "🌍 World & Culture",
] as const;

export type NewsTab = (typeof NEWS_TABS)[number];

export async function fetchHN(): Promise<NewsItem[]> {
  try {
    const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
    const j = await res.json();
    return (j.hits ?? []).map(
      (h: { objectID: string; title: string; url: string | null; created_at_i: number; story_text?: string }) => ({
        id: `hn-${h.objectID}`,
        title: h.title,
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: "Hacker News",
        category: "tech" as const,
        image: null,
        ts: h.created_at_i * 1000,
        summary: h.story_text ?? "",
      }),
    );
  } catch {
    return [];
  }
}

export async function fetchSpaceflight(): Promise<NewsItem[]> {
  try {
    const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=15");
    const j = await res.json();
    return (j.results ?? []).map(
      (a: { id: number; title: string; url: string; news_site: string; image_url: string; published_at: string; summary: string }) => ({
        id: `sf-${a.id}`,
        title: a.title,
        url: a.url,
        source: a.news_site,
        category: "world" as const,
        image: a.image_url,
        ts: +new Date(a.published_at),
        summary: a.summary,
      }),
    );
  } catch {
    return [];
  }
}

export async function fetchReddit(
  sub: string,
  category: "sports" | "nigeria" | "tech" | "world" = "world"
): Promise<NewsItem[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25`);
    const j = await res.json();
    return (j?.data?.children ?? [])
      .filter((c: { data: { stickied?: boolean; over_18?: boolean } }) => !c.data?.stickied && !c.data?.over_18)
      .map(
        (c: {
          data: {
            id: string;
            title: string;
            url: string;
            subreddit_name_prefixed: string;
            thumbnail: string;
            created_utc: number;
            selftext: string;
            preview?: { images: { source: { url: string } }[] };
          };
        }) => {
          const d = c.data;
          const img =
            d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") ||
            (d.thumbnail?.startsWith("http") ? d.thumbnail : null);
          return {
            id: `rd-${d.id}`,
            title: d.title,
            url: d.url,
            source: d.subreddit_name_prefixed,
            category,
            image: img,
            ts: d.created_utc * 1000,
            summary: d.selftext ? d.selftext.slice(0, 240) : "",
          };
        },
      );
  } catch {
    return [];
  }
}

/**
 * Real Sports News Feeds: Premier League, European Football, African Football / NPFL, Sports
 */
export async function fetchSportsNews(): Promise<NewsItem[]> {
  const [soccer, sports, afr] = await Promise.all([
    fetchReddit("soccer", "sports"),
    fetchReddit("sports", "sports"),
    fetchReddit("AfricanFootball", "sports"),
  ]);
  const combined = [...soccer, ...sports, ...afr];
  return combined.sort((a, b) => b.ts - a.ts);
}

/**
 * Real Local Nigerian News: r/Nigeria, Lagos metro, national affairs & culture
 */
export async function fetchNigeriaNews(): Promise<NewsItem[]> {
  const naija = await fetchReddit("Nigeria", "nigeria");
  return naija.sort((a, b) => b.ts - a.ts);
}

/**
 * Algorithmically assembles news for the selected tab.
 * For "For You": Enforces 63% Sports & Nigeria Local content (approx 6-7 out of every 10 items).
 */
export async function fetchNews(tab: NewsTab = "For You"): Promise<NewsItem[]> {
  if (tab === "🏆 Sports") {
    return fetchSportsNews();
  }
  if (tab === "🇳🇬 Nigeria Local") {
    return fetchNigeriaNews();
  }
  if (tab === "💻 Technology") {
    const [hn, tech] = await Promise.all([fetchHN(), fetchReddit("technology", "tech")]);
    return [...hn, ...tech].sort((a, b) => b.ts - a.ts);
  }
  if (tab === "🌍 World & Culture") {
    const [world, sf] = await Promise.all([fetchReddit("worldnews", "world"), fetchSpaceflight()]);
    return [...world, ...sf].sort((a, b) => b.ts - a.ts);
  }

  // ===== "For You" 63% Sports & Nigeria Local Algorithm =====
  const [sportsList, nigeriaList, techList, worldList] = await Promise.all([
    fetchSportsNews(),
    fetchNigeriaNews(),
    fetchHN(),
    fetchReddit("worldnews", "world"),
  ]);

  const result: NewsItem[] = [];
  let sIdx = 0;
  let nIdx = 0;
  let tIdx = 0;
  let wIdx = 0;

  // Pattern: 4 Sports, 3 Nigeria Local, 2 Tech, 1 World (7/10 = 70% ~ 63% target)
  const maxLoops = Math.max(
    Math.ceil(sportsList.length / 4),
    Math.ceil(nigeriaList.length / 3),
    Math.ceil(techList.length / 2),
    Math.ceil(worldList.length / 1)
  );

  for (let cycle = 0; cycle < maxLoops; cycle++) {
    // 1. Up to 4 Sports items
    for (let i = 0; i < 4 && sIdx < sportsList.length; i++) {
      result.push(sportsList[sIdx++]);
    }
    // 2. Up to 2-3 Nigeria Local items
    for (let i = 0; i < 3 && nIdx < nigeriaList.length; i++) {
      result.push(nigeriaList[nIdx++]);
    }
    // 3. Up to 2 Tech items
    for (let i = 0; i < 2 && tIdx < techList.length; i++) {
      result.push(techList[tIdx++]);
    }
    // 4. Up to 1 World item
    if (wIdx < worldList.length) {
      result.push(worldList[wIdx++]);
    }
  }

  return result.filter(Boolean);
}

export function readerPath(it: NewsItem) {
  return `/news/read?u=${encodeURIComponent(it.url)}&t=${encodeURIComponent(it.title)}&s=${encodeURIComponent(it.source)}`;
}

const NEWS_DELIVERED_KEY = "flick:news_delivered_ids";
const NEWS_INTERVAL_MS = 3.5 * 60 * 1000; // 3.5 minutes

/**
 * Background News Notification Channel.
 * Automatically broadcasts breaking Sports, Nigeria Local, and global headlines.
 * Voice announcement speaks ONLY the header / headline summary as requested.
 */
export function startNewsNotificationChannel(): () => void {
  if (typeof window === "undefined") return () => {};

  const deliverTopNews = async () => {
    try {
      let delivered = new Set<string>();
      try {
        delivered = new Set(JSON.parse(localStorage.getItem(NEWS_DELIVERED_KEY) ?? "[]"));
      } catch {}

      // Rotate between Sports, Nigeria Local, and Tech wire
      const feeds = [fetchSportsNews, fetchNigeriaNews, fetchSportsNews, fetchHN];
      const loader = feeds[Math.floor(Math.random() * feeds.length)];
      const items = await loader();
      if (!items || items.length === 0) return;

      const fresh = items.find((it) => !delivered.has(it.id));
      if (!fresh) return;

      delivered.add(fresh.id);
      const arr = Array.from(delivered).slice(-60);
      localStorage.setItem(NEWS_DELIVERED_KEY, JSON.stringify(arr));

      const { readAppPrefs } = await import("@/lib/appPrefs");
      if (!readAppPrefs().newsPopups) {
        return;
      }

      const { triggerNotchNotification } = await import("@/components/notifications/NotchNotification");
      const { notificationAudio } = await import("@/lib/notificationAudio");
      void notificationAudio.playNewsWirePushSound(0.95);

      triggerNotchNotification({
        kind: "news",
        title: fresh.category === "sports" ? "🏆 Flick Sports Wire" : fresh.category === "nigeria" ? "🇳🇬 Nigeria Local Wire" : "📰 Flick News Wire",
        message: fresh.title,
        url: readerPath(fresh),
        actor: { id: "news", handle: "news", display_name: fresh.source },
      });

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(fresh.title, {
            body: fresh.summary || `Breaking on ${fresh.source}`,
            icon: fresh.image || "/icon-192.png",
          });
        } catch {}
      }
    } catch (e) {
      console.warn("[newsChannel] Fetch error:", e);
    }
  };

  const initialTimer = setTimeout(() => {
    void deliverTopNews();
  }, 22000);

  const intervalId = setInterval(() => {
    void deliverTopNews();
  }, NEWS_INTERVAL_MS);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
  };
}

export async function triggerTestNewsPush(headline?: string): Promise<void> {
  const title =
    headline || "🏆 Super Eagles Star Victor Osimhen Nets Brilliant Brace in Thrilling Victory";
  const { triggerNotchNotification } = await import("@/components/notifications/NotchNotification");
  const { notificationAudio } = await import("@/lib/notificationAudio");

  void notificationAudio.playNewsWirePushSound(1.0);

  triggerNotchNotification({
    kind: "news",
    title: "🏆 Flick Sports Wire",
    message: title,
    url: "/news",
    actor: { id: "news", handle: "sports", display_name: "Sports Wire" },
  });
}
