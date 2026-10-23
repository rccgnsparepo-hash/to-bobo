// Smart grouping + time sectioning for the notification center.
export type NotifRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type NotifGroup = {
  key: string;
  head: NotifRow;
  items: NotifRow[];
  count: number;
  unread: number;
};

export type Section = { label: string; groups: NotifGroup[] };

/** Exactly-once display: collapse identical logical events (same kind+actor+target). */
export function dedupe(rows: NotifRow[]): NotifRow[] {
  const seen = new Map<string, NotifRow>();
  for (const n of rows) {
    const d = n.data as { post_id?: string; recipient_id?: string; dedupe_id?: string };
    const target = d?.dedupe_id ?? d?.post_id ?? d?.recipient_id ?? "";
    const bucket = Math.floor(new Date(n.created_at).getTime() / 60000);
    const key = `${n.kind}:${n.actor_id ?? "_"}:${target}:${bucket}`;
    if (!seen.has(key)) seen.set(key, n);
  }
  return [...seen.values()];
}

/** WhatsApp-style stacking: "John (4)" per actor+kind within a section. */
export function groupRows(rows: NotifRow[]): NotifGroup[] {
  const map = new Map<string, NotifGroup>();
  for (const n of rows) {
    const key = `${n.kind}:${n.actor_id ?? n.title}`;
    const g = map.get(key);
    if (g) {
      g.items.push(n);
      g.count += 1;
      if (!n.read_at) g.unread += 1;
    } else {
      map.set(key, { key, head: n, items: [n], count: 1, unread: n.read_at ? 0 : 1 });
    }
  }
  return [...map.values()];
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function sectionize(rows: NotifRow[]): Section[] {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = today - 86400000;
  const week = today - 6 * 86400000;
  const buckets: Record<string, NotifRow[]> = {
    TODAY: [],
    YESTERDAY: [],
    "THIS WEEK": [],
    OLDER: [],
  };
  for (const n of rows) {
    const t = new Date(n.created_at).getTime();
    if (t >= today) buckets.TODAY.push(n);
    else if (t >= yesterday) buckets.YESTERDAY.push(n);
    else if (t >= week) buckets["THIS WEEK"].push(n);
    else buckets.OLDER.push(n);
  }
  return Object.entries(buckets)
    .filter(([, v]) => v.length)
    .map(([label, v]) => ({ label, groups: groupRows(v) }));
}

const PRIORITY: Record<string, "high" | "normal" | "low"> = {
  message: "high",
  mention: "high",
  comment: "normal",
  story: "normal",
  post: "low",
  like: "low",
};
export const priorityOf = (kind: string) => PRIORITY[kind] ?? "normal";
