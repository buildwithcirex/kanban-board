# Team Kanban (Trello Clone) — Implementation Plan (v3, Supabase)

Team-based Kanban. Members belong to teams, see their team's boards, and cards assigned to them are highlighted. Drag and drop is built on ReactFlow. The app is an installable PWA with Web Push notifications on Android.

**Backend: Supabase (hosted).** No Docker anywhere. **Authentication UI is the last phase** (see §1.3).

Required libraries: **Tailwind CSS**, **ReactFlow** (`@xyflow/react`), **Lucide React**, **PWA** (`vite-plugin-pwa`).

---

## 1. Architecture

### 1.1 Stack

| Layer                   | Choice                                                                                    | Notes                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web app                 | **Vite + React 19 + TypeScript (strict)**                                                 | Single app, not a monorepo.                                                                                                                                                                 |
| Styling                 | **Tailwind CSS v4** + CSS-variable tokens                                                 | Mobile-first, light and dark themes.                                                                                                                                                        |
| Icons                   | **lucide-react**                                                                          |                                                                                                                                                                                             |
| Board / DnD / animation | **@xyflow/react**                                                                         | Lists and cards are custom nodes (§3). Also used for the dependency view.                                                                                                                   |
| Database                | **Supabase Postgres** (hosted project)                                                    | Permissions enforced by **Row Level Security (RLS)**.                                                                                                                                       |
| Data access             | **supabase-js** + generated TS types, wrapped in `src/lib/api/*`                          | Components never call Supabase directly.                                                                                                                                                    |
| Multi-step writes       | **Postgres functions (RPC)**                                                              | e.g. `move_card`, `assign_card` update the card, write the activity log and create notifications in one transaction.                                                                        |
| Realtime                | **Supabase Realtime** (Postgres changes, per-board channel)                               | Replaces the SSE plan.                                                                                                                                                                      |
| Files                   | **Supabase Storage** (private bucket + RLS)                                               | Attachments, avatars, board backgrounds.                                                                                                                                                    |
| Push sending            | **Supabase Edge Function** `send-push` (Deno, Web Push/VAPID)                             | Triggered by a Database Webhook on `notifications` insert.                                                                                                                                  |
| Scheduled jobs          | **pg_cron**                                                                               | Due-soon and overdue reminders.                                                                                                                                                             |
| Server state            | **TanStack Query** (+ IndexedDB persister)                                                | Caching, optimistic updates, offline read cache.                                                                                                                                            |
| Routing                 | **React Router**                                                                          | `/t/:teamId/b/:boardId/c/:cardId`                                                                                                                                                           |
| PWA                     | **vite-plugin-pwa** (`injectManifest`, custom service worker)                             | Needed for `push` and `notificationclick`.                                                                                                                                                  |
| Schema tooling          | **Supabase CLI** (npm dev dependency, `npx supabase`)                                     | Hand-written SQL migrations → `supabase db push`; `supabase gen types --project-id` for TS types. **Does not need Docker.** `supabase start` / `db diff` need Docker, so we don't use them. |
| Hosting (web)           | Static host with HTTPS (Vercel / Netlify / Cloudflare Pages)                              | HTTPS is required for push on Android.                                                                                                                                                      |
| Tests                   | Vitest, React Testing Library, Playwright; RLS tests against the **dev Supabase project** |                                                                                                                                                                                             |

Environments: two Supabase projects, **dev** and **prod**. Migrations are applied to dev first, then prod.

### 1.2 Secrets

- Browser: only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_VAPID_PUBLIC_KEY`.
- The **service-role key** and the **VAPID private key** live only in Edge Function secrets, never in the web app or the git repo.

### 1.3 "Auth later" with Supabase

RLS needs a signed-in user (`auth.uid()`). The two ways to handle that before login exists:

| Option                                                  | How                                                                                                                                                                                                            | Verdict                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **A. Dev sign-in behind a user switcher** (recommended) | Seed 3–4 test users in Supabase Auth. In dev builds only, a header switcher signs in as one of them automatically. RLS is real from day one. Phase 11 adds the real login screens, invites and password reset. | Permissions are tested from the start, and nothing gets rewritten later.                      |
| B. RLS disabled until Phase 11                          | Anyone with the public anon key can read and write all data.                                                                                                                                                   | ❌ Unsafe on a hosted database, and every access rule would be built and debugged at the end. |

Option A signs in with Supabase's real sign-in behind the scenes, but there are no login screens until Phase 11. The dev switcher and test credentials are never shipped in production builds.

---

## 2. Domain Model (Postgres, `public` schema)

```
profiles         id (= auth.users.id), name, email, avatar_url, color
teams            id, name, description, color, created_by
team_members     team_id, user_id, role: 'owner'|'admin'|'member'          PK(team_id,user_id)
boards           id, team_id, title, background, visibility:'team'|'private', archived, position
board_members    board_id, user_id                                         (private boards)
lists            id, board_id, title, position, wip_limit, archived
cards            id, board_id, list_id, title, description, position, start_date, due_date,
                 due_complete, priority, cover_color, archived, deleted_at, created_by
card_assignees   card_id, user_id, assigned_by, assigned_at               PK(card_id,user_id)
labels / card_labels, checklists / checklist_items (item: assignee_id, due_date)
comments         id, card_id, author_id, body, mentions uuid[]
attachments      id, card_id, uploader_id, name, mime, size, storage_path
dependencies     id, from_card_id, to_card_id, type
activity         id, team_id, board_id, card_id, actor_id, type, payload, created_at
notifications    id, user_id, type, card_id, board_id, payload, read_at, created_at
push_subscriptions id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, last_success_at
notification_prefs user_id, type, in_app bool, push bool
```

- `position` values are fractional-index text, so a move updates only one row.
- Every table has `created_at` and `updated_at` (set by a trigger).
- Indexes: `cards(list_id, position)`, `card_assignees(user_id)`, `cards(due_date)`, `notifications(user_id, read_at)`, `activity(board_id, created_at)`.

### RLS approach

- Helper functions marked `security definer` and `stable`: `is_team_member(team_id)`, `team_role(team_id)`, `can_access_board(board_id)`.
- Every table's policies go through those helpers.
- Tests: SQL/JS tests sign in as each test user and check that a user outside the team **cannot** read or write the team's rows.

| Action                                  | Owner | Admin              | Member                                  |
| --------------------------------------- | ----- | ------------------ | --------------------------------------- |
| Manage team, members, roles             | ✅    | ✅ (not the owner) | ❌                                      |
| Create/archive boards                   | ✅    | ✅                 | configurable                            |
| Create/edit/move cards, comment, assign | ✅    | ✅                 | ✅                                      |
| View team boards                        | ✅    | ✅                 | ✅ (private boards: board members only) |

---

## 3. ReactFlow Kanban Design

- **List nodes** are placed in a row and dragged by their header (`dragHandle`) to reorder lists.
- **Card nodes** are laid out inside their list. Positions are computed from list order, card order and measured heights, and never stored.
- **Dragging:**
  - `onNodeDrag` works out the target list and insertion index. Other cards slide apart with a CSS transform transition, which is the animation.
  - `onNodeDragStop` calls the `move_card` RPC with an optimistic update. If it fails, the card animates back.
- **Canvas:** pan by dragging empty space or with trackpad scroll; zoom limited on the board; `onlyRenderVisibleElements` for large boards; inputs inside nodes use the `nodrag` / `nopan` classes.
- **Mobile:** a long-press starts a card drag, so a swipe pans instead. On narrow screens, one list at a time snaps into view.
- **Accessibility:** every card has a "Move…" menu (pick list and position), and moves are announced through an `aria-live` region.
- **Highlighting:** your cards get an accent ring and a "You" chip. A "My cards only" switch dims everyone else's cards, and member avatar filters highlight a teammate's cards.
- **Live updates:** a Realtime event from a teammate updates the cache, and the affected nodes animate to their new place.
- ⚠️ Phase 4 starts with a proof of concept for drag, animation and touch.

---

## 4. Push Notifications (Android)

1. The user opts in from a button. The app calls `Notification.requestPermission()`, then `pushManager.subscribe(VAPID public key)`, then upserts the subscription into `push_subscriptions` (RLS: own rows only).
2. Domain events inside RPCs and triggers insert rows into `notifications`: being assigned, @mentions, comments on your card, being added to a team.
3. **pg_cron** (every 15 minutes) inserts due-soon (next 24 h) and overdue notifications, once per card.
4. A **Database Webhook** on `notifications` INSERT calls the **Edge Function `send-push`**. It checks the user's notification settings, sends to each of the user's devices with VAPID, deletes subscriptions that return 404 or 410, and records successful sends.
5. **Service worker:** the `push` event shows the notification (title, body, icon, monochrome badge, link to the card). The `notificationclick` event focuses an open app window or opens the card.
6. **In-app:** a bell and inbox on the same `notifications` rows, updated live through Realtime.

**Notes:**

- Android needs HTTPS. Test on a phone with the deployed preview URL (static host), so no tunnel is needed.
- iOS only gets push for an installed PWA on iOS 16.4+. It should work as-is, but is not a v1 target.
- ⚠️ Verify at the start of Phase 8 that the Web Push library works in the Deno runtime (`npm:web-push`, or a Deno-native Web Push library).

---

## 5. PWA & Responsiveness

- Responsive layout comes from mobile-first Tailwind, checked at 360, 768 and 1280 px. The PWA adds install, offline and push.
- **Manifest:** icons (192, 512, maskable, monochrome badge), `display: standalone`, shortcuts (My Tasks, Notifications).
- **Service worker:** precache the app shell. The last-viewed boards and My Tasks are cached for offline reading, and editing is disabled while offline with a banner.
- Update toast, install button, bottom navigation on mobile, card details as a full-screen sheet, touch targets at least 44 px.

---

## 6. Folder Structure

```
src/
  app/            shell, router, providers, error boundary
  features/       teams, boards, board-canvas, card, my-tasks, notifications, views, settings, dev-user-switcher
  components/ui/  primitives
  lib/            supabase client, api/* (typed data access), ordering, permissions
  pwa/            sw.ts, register, push
  types/          database.types.ts (generated)
supabase/
  migrations/     *.sql (schema, RLS, RPCs, triggers, cron)
  functions/send-push/
  seed.sql        test users' profiles, teams, sample boards
tests/            unit, rls, e2e
```

---

## 7. Phases

| #      | Phase                               | Scope                                                                                                                                                                                                                          | Done when                                                                                                                  | Rough effort |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **0**  | **Foundation**                      | Vite + TS + Tailwind, lint/format/Vitest/Playwright, Supabase CLI linked to the dev project, env setup, supabase client, app shell, UI primitives                                                                              | App builds; connects to Supabase; lint and tests pass                                                                      | 2 days       |
| **1**  | **Schema, RLS & dev users**         | Migrations for all core tables, RLS helpers and policies, `updated_at` triggers, seed users and teams, generated types, dev user switcher (signs in behind the scenes), RLS tests                                              | A user outside the team cannot read or write the team's data (tests)                                                       | 3–4 days     |
| **2**  | **Teams & members**                 | Create team, add/remove members, roles, team switcher, team page                                                                                                                                                               | Switching user changes which teams are visible                                                                             | 2–3 days     |
| **3**  | **Boards & lists**                  | Team boards page, create/rename/archive boards, backgrounds (Storage), private boards, list create/rename/archive                                                                                                              | Boards scoped by team; archive and restore work                                                                            | 2–3 days     |
| **4**  | **ReactFlow Kanban**                | Proof of concept, list and card nodes, computed layout, drag with gap animation, `move_card` RPC, list reorder, long-press on touch, "Move…" menu, card front, **assigned-to-me highlight**, "My cards only"                   | Order persists; drag works with mouse and touch; highlight visible; 300-card board stays smooth                            | 6–8 days     |
| **5**  | **Card detail**                     | Sheet/dialog, description, **assignees** (`assign_card` RPC), labels, dates, priority, checklists, comments with @mentions, attachments (Storage), activity, move/copy/archive                                                 | Fields round-trip; only team members can be assigned                                                                       | 4–5 days     |
| **6**  | **My Tasks & team views**           | My Tasks across teams (overdue / today / this week / later), team workload overview, board filters                                                                                                                             | A member sees exactly their assigned cards                                                                                 | 2–3 days     |
| **7**  | **Realtime & in-app notifications** | Realtime channels, cache updates, notification bell and inbox, read/unread, activity feed                                                                                                                                      | Two browsers as different users see each other's changes live                                                              | 2–3 days     |
| **8**  | **PWA + Android push**              | Manifest, icons, custom SW, offline read cache, update/install prompts, VAPID keys, `push_subscriptions`, `send-push` Edge Function + webhook, pg_cron reminders, notification settings                                        | On a real Android phone: a card assigned to you shows a system notification with the app closed; tapping it opens the card | 4–5 days     |
| **9**  | **Extra views & productivity**      | Dependency view (ReactFlow), calendar, table, Ctrl/Cmd+K search, shortcuts, templates, undo                                                                                                                                    | —                                                                                                                          | 4–5 days     |
| **10** | **Hardening & deploy**              | Accessibility (axe), performance (lazy-loaded views), end-to-end suite, prod Supabase project, static host deploy, security headers                                                                                            | End-to-end tests pass against the deployed preview                                                                         | 2–3 days     |
| **11** | **Authentication UI**               | Login/sign-up/logout/password reset (Supabase Auth), **email invites to teams** (Edge Function), remove the dev switcher, auth settings (email confirmation, redirect URLs, rate limits), security review of RLS and functions | Nobody gets in without an account; the invite → join team flow works                                                       | 3–4 days     |

**Total: roughly 36–48 working days** (fewer than v2, because there is no separate API server).

---

## 8. Testing

- **Unit:** ordering, board layout calculation, permission helpers, date grouping.
- **RLS/RPC:** signed in as each test user against the dev project: team isolation, role rules, and the RPCs.
- **End-to-end:** create team → board → cards → assign → drag → My Tasks → notification in the inbox. Real push is checked by hand on an Android phone.

## 9. Risks

| Risk                                                         | Mitigation                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| RLS mistakes expose other teams' data                        | Helper functions + RLS test suite from Phase 1; review in Phase 11                            |
| Service-role or VAPID private key leaks                      | Stored only in Edge Function secrets; `.env*` git-ignored                                     |
| No local database (no Docker)                                | Separate dev Supabase project; migrations reviewed before `db push`; never experiment on prod |
| ReactFlow as a list-sorting DnD                              | Proof of concept at the start of Phase 4; "Move…" menu as a fallback                          |
| Web Push in the Deno Edge runtime                            | Check at the start of Phase 8; a Deno-native Web Push library as a fallback                   |
| Supabase free tier (projects pause after inactivity, limits) | Fine for development; plan a paid tier for team use                                           |

## 10. Open Decisions

1. **Dev sign-in approach (§1.3):** Option A (recommended) or B?
2. **Who can create teams and boards?** Any user, or only admins?
3. **Offline:** read-only (recommended) or full offline editing?
4. **New dependencies:** `@supabase/supabase-js`, `supabase` CLI (dev dependency), TanStack Query, React Router, zod.
5. **Supabase projects:** you create the dev (and later prod) projects and put the URL and anon key in `.env.local`. I'll never need the service-role key in the web app.
