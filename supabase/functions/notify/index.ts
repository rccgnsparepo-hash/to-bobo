import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type NotifyKind =
  | 'post'
  | 'message'
  | 'story'
  | 'comment'
  | 'like'
  | 'mention'
  | 'typing'
  | 'reaction'
  | 'follow'
  | 'verification'
  | 'system'
  | 'other';

type Body = {
  kind: NotifyKind;
  title?: string;
  message?: string;
  url?: string;
  actor?: { id?: string; handle?: string; display_name?: string } | null;
  data?: Record<string, unknown>;
  recipients?: string[];
  dedupe_id?: string;
};

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
const NOTIFY_WEBHOOK_URL = Deno.env.get('NOTIFY_WEBHOOK_URL');
const APP_ORIGIN = (Deno.env.get('PUBLIC_APP_URL') ?? 'https://snap-spark-x.lovable.app').replace(/\/$/, '');

/** kind + resource -> in-app path. Mirrors src/lib/native/deepLink.ts. */
function pathFor(kind: Body['kind'], id?: string | null): string {
  switch (kind) {
    case 'message':
    case 'typing': return id ? `/messages/${id}` : '/messages';
    case 'story': return id ? `/?story=${encodeURIComponent(id)}` : '/';
    case 'post':
    case 'like':
    case 'comment':
    case 'reaction':
    case 'mention':
    case 'verification':
    case 'system':
    case 'other':
    case 'follow':
      return id ? `/?post=${encodeURIComponent(id)}` : '/';
    default: return '/';
  }
}

const defaultTitle = (k: Body['kind'], who: string) => {
  switch (k) {
    case 'post': return `${who} just flicked`;
    case 'message': return `${who} sent a message`;
    case 'story': return `${who} posted a story`;
    case 'comment': return `${who} commented`;
    case 'like': return `${who} liked your flick`;
    case 'typing': return `${who} is typing…`;
    case 'mention': return `${who} mentioned you`;
    case 'verification': return `${who} updated verification`;
    default: return `${who} updated something`;
  }
};

/** POST with bounded exponential backoff; retries only on network errors / 5xx / 429. */
async function postWithRetry(url: string, init: RequestInit, attempts = 3): Promise<{ ok: boolean; body: string }> {
  let last = '';
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      last = await res.text();
      if (res.ok) return { ok: true, body: last };
      if (res.status < 500 && res.status !== 429) return { ok: false, body: last };
    } catch (e) {
      last = String(e);
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  console.error('[notify] delivery failed after retries', url, last);
  return { ok: false, body: last };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const who = body.actor?.display_name || body.actor?.handle || 'Someone';
    const title = body.title ?? defaultTitle(body.kind, who);
    const message = body.message ?? '';
    const payload = {
      kind: body.kind,
      title,
      message,
      url: body.url ?? null,
      actor: body.actor ?? null,
      data: body.data ?? {},
      at: new Date().toISOString(),
    };

    const tasks: Promise<unknown>[] = [];
    if (NOTIFY_WEBHOOK_URL) {
      tasks.push(postWithRetry(NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));
    }
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY && body.kind !== 'typing') {
      const targets = (body.recipients ?? []).filter((r) => r && r !== body.actor?.id);
      const kind = body.kind;
      const senderId = (body.data as { senderId?: string } | undefined)?.senderId ?? body.actor?.id ?? null;
      const resourceId =
        (body.data as { message_id?: string; post_id?: string; story_id?: string; senderId?: string } | undefined)?.message_id ??
        (body.data as { message_id?: string; post_id?: string; story_id?: string; senderId?: string } | undefined)?.post_id ??
        (body.data as { message_id?: string; post_id?: string; story_id?: string; senderId?: string } | undefined)?.story_id ??
        senderId ??
        null;
      const relPath =
        body.url && body.url.startsWith('/')
          ? body.url
          : kind === 'typing'
            ? `/messages/${senderId ?? ''}`
            : pathFor(kind, resourceId);
      const effectiveOrigin = (body.data as { app_origin?: string })?.app_origin || APP_ORIGIN;
      const launchUrl = body.url && /^https?:\/\//.test(body.url) ? body.url : `${effectiveOrigin}${relPath}`;
      const deepLinkData = {
        type: body.kind,
        resourceId,
        senderId,
        deepLink: relPath,
        title,
        body: kind === 'typing' ? 'Typing…' : message || title,
        timestamp: payload.at,
        dedupe_id: body.dedupe_id ?? null,
      };

      const osPayload: Record<string, unknown> = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: kind === 'typing' ? 'Typing…' : message || title },
        url: launchUrl,
        web_url: launchUrl,
        app_url: `flick:${relPath}`,
        data: deepLinkData,
        collapse_id: body.dedupe_id ?? undefined,
        android_channel_id: kind === 'typing' ? 'messages' : (kind === 'message' ? 'messages' : 'posts'),
        chrome_web_icon: `${effectiveOrigin}/icon-192.png`,
        chrome_web_badge: `${effectiveOrigin}/icon-192.png`,
        priority: 10,
      };

      if (targets.length) {
        // Modern OneSignal User model (SDK v16)
        (osPayload as any).include_aliases = { external_id: targets };
        (osPayload as any).target_channel = 'push';
        // Legacy fallback
        (osPayload as any).include_external_user_ids = targets;
        (osPayload as any).channel_for_external_user_ids = 'push';
      } else {
        (osPayload as any).included_segments = ['Total Subscriptions', 'Subscribed Users'];
      }

      tasks.push(postWithRetry('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_REST_API_KEY}` },
        body: JSON.stringify(osPayload),
      }));
    }

    const results = (await Promise.all(tasks)) as { ok: boolean; body?: string }[];
    const delivered = results.filter((r) => r?.ok).length;
    return new Response(JSON.stringify({ ok: true, attempted: results.length, delivered, details: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

