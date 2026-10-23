
You picked migration + all 4 feature groups. That's roughly 3–4 days of focused work if done well. I'll execute it in clearly scoped phases so each phase ships working code instead of half of everything being broken at once. After each phase you can test, give feedback, then I move to the next.

## Phase 0 — Migrate to plain Vite SPA (foundation)

Required before anything else, since it changes routing/build.

- Replace TanStack Start with Vite + React + React Router v6.
- New entry: `index.html`, `src/main.tsx`, `src/App.tsx` with `<BrowserRouter>`.
- Convert every `src/routes/_app.*.tsx` file to a regular page component under `src/pages/`.
- Replace `createFileRoute`, `Route.useParams`, `useNavigate` from `@tanstack/react-router` with `useParams`, `useNavigate`, `Link` from `react-router-dom`.
- Delete server-only files: `src/server.ts`, `src/start.ts`, `src/integrations/supabase/auth-middleware.ts`, `auth-attacher.ts`, `client.server.ts`, `wrangler.jsonc`, `src/routes/sitemap[.]xml.ts`, `src/routes/api/*` if any.
- Replace `vite.config.ts` with a plain `@vitejs/plugin-react` config.
- Add `vercel.json` with SPA rewrite (`/* → /index.html`).
- All Supabase calls go through the browser client only — RLS already protects everything.

## Phase 1 — Posts & Flicks upgrades

- Multi-media composer: text, image, **video**, **audio upload**, **voice note** (MediaRecorder API).
- `posts` table: add `media_type` (text|image|video|audio), keep `media_url`.
- New `comments` table + realtime comment sheet on PostCard (the chat icon opens it).
- New `reshares` table + reshare button increments + shows in feed.
- Real-time like/comment/reshare counts via Supabase Realtime channels.

## Phase 2 — Stories & Camera

- Camera tab (bottom bar) becomes **photo-only quick capture**, single tap to story.
- New `/stories/new` composer page with three tabs: **Bulk Photos**, **Video** (≤50MB, ≤60s), **Tag People** (search profiles by handle, store in `story_tags`).
- Story cards show "Xh Ym left" countdown using `expires_at`.
- New `story_tags` table.

## Phase 3 — Messaging upgrades

- Thread list with last-message preview, unread badge (`messages.read_at` per recipient).
- Auto-cull expired messages every 30s in the list AND thread view.
- Voice notes in chat (record + upload to `media` bucket, type=`audio`).
- File attachments (any type ≤25MB).
- Per-thread chat background image (stored in `chat_settings` table).
- User search by handle in DM sidebar.

## Phase 4 — Discovery: Daily Challenges + Comics

- `daily_challenges` table seeded with one challenge per day; banner on Home.
- `challenge_submissions` joins user → challenge → post.
- `/comics` route with `comics` table (title, cover, pages[]) and a swipeable reader.

## Storage limits enforced client-side
Photos 10MB · Video 50MB / 60s · Audio/voice 2min · Files 25MB.

## What I will NOT do automatically
- AR face filters in camera (out of scope without a CV library; current CSS filters stay).
- Push notifications.
- Comics content seeding — you'll add comics via DB or I can build a minimal admin page later.

## Suggested order to approve
Approve Phase 0 + Phase 1 to start. I'll ship those, you test, then I'll proceed through 2 → 3 → 4. If you want me to bundle all phases into one mega-commit instead, say so explicitly — but expect rough edges that need cleanup passes.
