# Flick Platform Enhancements

This document outlines the major upgrade to Flick: Navigation Cleanup, Search & Explore, Privacy Center, Safety Tools & Moderation Queue, and Private Bookmarks.

---

## 1. Database Schema & RLS Policies

All new tables are defined in `supabase/migrations/20261104_flick_enhancements.sql`.

### Tables Created

| Table Name | Description | RLS Policy |
| :--- | :--- | :--- |
| `privacy_settings` | Stores per-user visibility, DM permissions, read receipts, and disappearing chat timer | `FOR ALL USING (auth.uid() = user_id)` (Strict user ownership) |
| `close_friends` | Private circle for close friends-only stories | `FOR ALL USING (auth.uid() = user_id)` |
| `user_blocks` | Bidirectional account blocks across feed, search, and DMs | `FOR ALL USING (auth.uid() = blocker_id)` |
| `user_mutes` | Mutes accounts from appearing in the muter's feed | `FOR ALL USING (auth.uid() = user_id)` |
| `muted_keywords` | Client and server keyword suppression list | `FOR ALL USING (auth.uid() = user_id)` |
| `moderation_reports` | Moderation queue for user reports with reasons and statuses | `SELECT USING (auth.uid() = reporter_id)`, `INSERT WITH CHECK (auth.uid() = reporter_id)` |
| `moderation_appeals` | One-time appeal tickets filed by users against moderation actions | `FOR ALL USING (auth.uid() = user_id)` |
| `bookmark_folders` | Custom bookmark collections (e.g., Tech, Memes, Vibes) | `FOR ALL USING (auth.uid() = user_id)` |
| `bookmarks` | Private saved flicks; never displayed or counted to external users | `FOR ALL USING (auth.uid() = user_id)` (Strictly isolated) |
| `account_deletion_requests` | 14-day grace period account deletion schedule | `FOR ALL USING (auth.uid() = user_id)` |

### Trigram & Full-Text Search Indexes
- `idx_posts_content_trgm`: PostgreSQL trigram index for substring and fuzzy post searching.
- `idx_profiles_handle_trgm`: Trigram index on username `@handle`.
- `idx_profiles_name_trgm`: Trigram index on user `display_name`.

---

## 2. Nav Cleanup
- **Sidebar Order**: Home, Explore, DMs, Profile, Notifications, Flick Games.
- **Lime `+` Button**: Single create entry on sidebar and mobile floating dock opening `CreateActionSheet` (bottom sheet on mobile, centered modal on desktop) with:
  - New post (algorithm feed composer)
  - Camera & Filters (real-time look styles & story composer)
  - Go live (live broadcast session with pulsing red dot)
  - Reserved slot for "Start a class" (disabled with *Coming Soon* indicator)
- **Tabs Refactored**:
  - "News" replaced by "Following" tab inside `Home.tsx` (`/?tab=following`).
  - "World" replaced by "Discover" tab inside `/explore`.
  - "Me" renamed to "Profile".
- **Unread Count Badges**:
  - DMs and Notifications formatted as numbers `1` through `9`, and `9+` when count exceeds 9.
- **Mobile 5-Item Dock**:
  - `Home`, `Explore`, `+`, `DMs`, `Profile`.
  - Notifications bell in the top mobile navigation bar with dynamic unread badge.
- **Accessibility**: Full keyboard navigation with `focus-visible:ring-2 focus-visible:ring-snap` rings and explicit `aria-label` attributes.

---

## 3. Search & Explore (`/explore`)
- Sticky search bar with 250ms debounce and active tab filters: **Top**, **People**, **Posts**, **Tags**.
- On-device recent searches with one-tap "Clear" button.
- Empty state displays:
  - 24h Trending tags with growth velocity indicators.
  - Suggested accounts with transparent "Why am I seeing this?" attribution badges and inline follow actions.
  - Discover flicks feed.
- Blocked and muted accounts never appear in results. Private accounts show only display name and avatar with locked badge.
- Animated skeleton loading states, error states with retry, and plain-language empty states.

---

## 4. Privacy Center (`/settings/privacy`)
- Top summary card displaying real-time exposure status with one-tap "Make private" / "Make public" toggle.
- Direct message permissions: `Everyone`, `People I follow`, `No one`.
- Post & story visibility: `Public`, `Followers`, `Close friends`.
- Interactive Close Friends manager with search and one-tap member toggle.
- Read receipts and typing indicator switches.
- Explore search & suggestions discovery visibility toggle.
- Disappearing chat default timer: `Off`, `24 hours`, `7 days`, `30 days`.
- Blocked & Muted accounts manager with instant unblock / unmute.
- Muted keyword manager with word boundary detection in feed posts.
- Async JSON data archive download generator.
- Account deletion with 14-day grace period and cancellation capability.

---

## 5. Safety Tools & Moderation Queue
- Contextual reporting on posts, profiles, stories, and messages with reason selector (`spam`, `harassment`, `hate`, `self_harm`, `nudity`, `impersonation`, `other`) and optional context note.
- In-memory and persisted rate-limiting (max 5 reports per minute, max 20 follows per minute) with user-friendly retry timers.
- Role-gated admin moderation queue (`/admin/moderation`) allowing reviewers to dismiss, remove content, warn users, or suspend accounts.
- Automatic notifications to reporters upon ticket resolution.

---

## 6. Bookmarks (`/bookmarks`)
- One-tap private bookmark icon on every post card.
- Dedicated Bookmarks screen with real-time search within saved content.
- Custom collection folders with custom color tagging.
- Bulk selection and deletion mode with counter.
- Graceful placeholders for deleted posts or blocked authors with one-tap removal.

---

## 7. Environment & Setup

Run migrations in your Supabase SQL editor:
```bash
# Apply migrations:
supabase/migrations/20261104_flick_enhancements.sql
```

Development server:
```bash
npm run dev
```

Build production bundle:
```bash
npm run build
```
