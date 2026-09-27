# Project context

Read this first. It is the current state of the project in one file, kept up to date as work
happens, so a fresh session does not have to reverse-engineer the repo.

- **What this is:** a team Kanban board (Trello clone) on Supabase. Trello is the product
  reference: where behaviour is unspecified, do what Trello does.
- **The plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — architecture, domain
  model and the 12 phases. It is the contract for technology choices; do not deviate from it.
- **Last updated:** 2026-09-27 — Phase 6 done and verified against the live dev project.

---

## Where we are

| Phase                               | Status                                                                |
| ----------------------------------- | --------------------------------------------------------------------- |
| 0 — Foundation                      | ✅ done                                                               |
| 1 — Schema, RLS & dev users         | ✅ done — migrations pushed, seeded, sign-in and RLS verified live    |
| 2 — Teams & members                 | ✅ done — create, switch, roles, add/remove, verified live            |
| 3 — Boards & lists                  | ✅ done — boards, private boards, backgrounds, lists, archiving       |
| 4 — ReactFlow Kanban                | ✅ done — drag, gap animation, move_card, Move… menu, my-cards filter |
| 5 — Card detail                     | ⬜ next                                                               |
| 6 — My Tasks & team views           | ⬜                                                                    |
| 7 — Realtime & in-app notifications | ⬜                                                                    |
| 8 — PWA + Android push              | ⬜                                                                    |
| 9 — Extra views & productivity      | ⬜                                                                    |
| 10 — Hardening & deploy             | ⬜                                                                    |
| 11 — Authentication UI              | ⬜ (last, on purpose)                                                 |

### Database state

The dev project is **linked, migrated and seeded**. Sign-in works and `npm run test:rls` passes
(92 tests) against it. `src/types/database.types.ts` is generated from the live schema.

Useful commands (the CLI is logged in and linked):

```bash
npx supabase migration list          # what is applied remotely
npm run db:push                      # apply new migrations
npx supabase db push --include-seed  # re-run supabase/seed.sql
npx supabase db query --linked "select ..."   # ad-hoc SQL against the dev project
npm run db:types                     # regenerate types after a schema change
npm run test:rls                     # prove the policies over the network
```

⚠️ `db push --include-seed` hashes the seed file and **skips re-running it** if it thinks it is
already applied — it prints "Updating seed hash" instead of "Seeding data". When the seed must
genuinely re-run, apply the statements with `supabase db query` instead.

---

## Stack (fixed by the plan)

Vite + React 19 + TypeScript strict · Tailwind CSS v4 (CSS-variable tokens, light/dark) ·
lucide-react · React Router · TanStack Query · Supabase (Postgres + RLS + Realtime + Storage +
Edge Functions) · `@xyflow/react` for the board canvas (Phase 4) · `vite-plugin-pwa` (Phase 8) ·
Vitest + Testing Library + Playwright.

**No Docker anywhere.** Migrations are hand-written SQL pushed to a hosted dev project with
`npx supabase db push`. `supabase start` / `db diff` are never used.

---

## What exists now

### Database (`supabase/migrations/`, applied in filename order)

| File                                   | Contents                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `…090000_core_schema.sql`              | 5 enums, 19 tables, indexes, `updated_at` triggers, RLS switched on everywhere  |
| `…090100_rls_helpers.sql`              | Privilege grants + 14 `security definer` authorization helpers                  |
| `…090200_rls_policies.sql`             | 65 policies, all `to authenticated`                                             |
| `…090300_triggers.sql`                 | Profile-on-signup, email sync, team-owner membership, `created_by` immutability |
| `…090400_team_rpcs.sql`                | `create_team(name, description, color)` RPC                                     |
| `…0926090000_team_member_rpcs.sql`     | `add_team_member` / `set_team_member_role` / `remove_team_member`               |
| `…0926091000_rpc_not_found_status.sql` | Those three again, raising `PT404` instead of `P0002`                           |

Design decisions worth knowing:

- **Ordering** uses fractional-index strings in `position text collate "C"`, so a move rewrites
  one row. `collate "C"` makes ordering plain byte order, matching the client's index maths.
- **Cross-table integrity is in the database.** Composite foreign keys mean a card can never point
  at a list on a different board, and a card can never take a label from another board.
- **Authorization lives in helpers, not in policies.** Every policy is one call to
  `is_team_member` / `can_access_board` / `can_edit_card` / … Each helper is
  `security definer, stable, set search_path = ''` with fully-qualified names — the empty
  search_path is what stops search-path hijacking, and `security definer` is what stops the
  `team_members` policy recursing into itself.
  ⚠️ **Never add `force row level security` to `team_members`, `boards` or `board_members`** —
  that would reintroduce the recursion the helpers avoid.
- **Policies call `(select auth.uid())`**, not `auth.uid()`, so Postgres evaluates it once per
  statement instead of once per row.
- **Default deny.** `anon` is revoked from every table and function (including future ones via
  `alter default privileges`), and every policy is scoped `to authenticated`. The public anon key
  on its own reads and writes nothing.
- **Append-only feeds.** `activity` has no insert policy and `notifications` has no insert grant;
  both are written only by `security definer` code (RPCs, triggers, cron, `send-push`).
- **Identity is not user-editable.** `profiles.email` is owned by Supabase Auth: a trigger reverts
  any client change, so nobody can display a teammate's address as their own. `created_by` is
  likewise frozen after insert on teams, boards and cards.
- **Hand-made `auth.users` rows need empty-string token columns.** GoTrue reads
  `confirmation_token`, `recovery_token`, `email_change*`, `phone_change*` and
  `reauthentication_token` into non-nullable Go strings. Left NULL, every sign-in fails with
  _"Database error querying schema"_ (HTTP 500) — not "invalid credentials", which makes it look
  like the user is missing. `supabase/seed.sql` sets them to `''`.
- **Membership changes go through RPCs, not table writes.** `add_team_member` has to read
  `auth.users` to resolve an email, and all three write to `activity`, which has no insert policy
  so clients cannot forge it. They are therefore `security definer` and re-check the caller
  themselves; the `team_members` policies stay as defence in depth, and
  `tests/rls/team-members.test.ts` pins both directions.
- **Error codes are the API.** The RPCs raise `42501` (not allowed), `PT404` (no such
  account/member), `23505` (already a member) and `22023` (bad argument); `src/lib/api/errors.ts`
  maps those to sentences. ⚠️ Use `PT404`, not `P0002`: PostgREST has no mapping for
  `no_data_found` and answers **500**, so a mistyped email would look like a server fault.
  `PT<status>` is PostgREST's "respond with this HTTP status" convention.
- **A policy should test the row it already has, not re-read the table.** `boards_select` used to
  call `can_access_board(id)`, which reads `boards` — so it could not see the row an
  `insert ... returning` was creating, and refused it with 42501. It now tests `team_id` and
  `visibility` directly, plus `is_board_member(id)` for private boards, which is both faster and
  free of that trap.
- **Three writes need an RPC because RETURNING re-checks the SELECT policy** against a row whose
  supporting rows do not exist yet: `create_team` (owner membership), `create_board` (private
  board membership + default lists) and `set_board_visibility` (membership when turning private).
  A `STABLE` policy helper cannot see rows written by the same statement, which is the whole
  reason. `handle_board_visibility_change` is an AFTER trigger that catches a direct
  `update ... set visibility` done without the RPC, so a board can never become invisible to
  everyone.
- **Board backgrounds live in a private bucket.** Objects are named `<board_id>/<random>.<ext>`
  and the policies read the first path segment, so authorisation is the board's. There is no
  public URL; the client asks for a signed one, refreshed every 45 minutes.
- **`create_team` must be used instead of inserting into `teams`.** A plain
  `insert ... select()` fails: RETURNING re-checks the SELECT policy, and the owner membership
  that makes the team visible does not exist yet at that instant. The RPC does both writes in one
  transaction. (The AFTER INSERT trigger stays as a safety net so no team can exist ownerless.)

### Permission model

| Action                                  | Owner | Admin              | Member                                  |
| --------------------------------------- | ----- | ------------------ | --------------------------------------- |
| Manage team, members, roles             | ✅    | ✅ (not the owner) | ❌                                      |
| Create boards                           | ✅    | ✅                 | ✅                                      |
| Delete a board                          | ✅    | ✅                 | ❌                                      |
| Create/edit/move cards, comment, assign | ✅    | ✅                 | ✅                                      |
| View team boards                        | ✅    | ✅                 | ✅ (private boards: board members only) |

Open decision #2 from the plan was settled as: **any signed-in user can create a team; any team
member can create a board; only owners/admins can delete one.** Change it in
`…090200_rls_policies.sql` if that turns out wrong.

Boards add: any team member can create one, only owners/admins can delete one, and an archived
board is read-only (enforced by `can_edit_board`, not by the UI). A **private** board is visible
only to its `board_members`, admins included.

⚠️ Known edge: a team admin cannot delete a private board they are not on — Postgres applies the
SELECT policy to a DELETE that filters on a column, so the row is not there for them. If everyone
on a private board leaves the team, it becomes invisible and only goes away with the team. Pinned
by a test in `tests/rls/boards.test.ts`; revisit if it bites.

The owner's row is immutable: their role cannot be changed (not even by themselves), and they
cannot be removed or leave — deleting the team is the way out. **There is deliberately no
ownership transfer yet**, so a team cannot change hands. Worth deciding before Phase 11; it would
be a `transfer_team_ownership` RPC swapping two rows in one transaction, since the
`team_members_single_owner_idx` partial unique index forbids a moment with two owners.

### App code

```
src/
  app/          AppShell (nav, theme, AuthGate), routes, pageTitle, 404, error boundary
  components/ui Button, IconButton, Input, Textarea, Select, Dialog, ConfirmDialog,
                Avatar, Spinner, EmptyState, Page
  features/
    auth/               AuthContext, AuthProvider (owns the Supabase session), useAuth
    dev-user-switcher/  DEV-ONLY sign-in as a seeded user
    teams/              TeamsPage (overview), TeamPage (/t/:teamId), TeamMembers,
                        TeamNav (sidebar switcher), CreateTeamDialog, TeamSettingsDialog,
                        ColorPicker, teamSchema (zod), useTeams (queries + mutations)
    boards/             BoardsPage (all boards), BoardPage (/t/:teamId/b/:boardId),
                        TeamBoards (section on a team page), BoardTile, ListColumn +
                        AddListForm, CreateBoardDialog, BoardSettingsDialog,
                        BackgroundSwatches, boardSchema, useBoards, useLists
    my-tasks|notifications|settings/  placeholder pages
  lib/
    api/        errors.ts (UI-safe error mapping), keys.ts (query keys), teams.ts, profiles.ts
    env.ts      zod-validated env; also parses the DEV-only password
    initials.ts avatar fallback letters
    ordering.ts fractional-index positions (see below)
    supabase.ts typed client (PKCE, auto-refresh)
    theme.ts    light/dark, applied before first paint
  types/database.types.ts   generated — regenerate with npm run db:types, never hand-edit
```

- **Nothing renders without a session.** `AuthGate` in the shell gates every route except those
  whose route handle says `public: true` (only the 404 page today).
- **Components never call Supabase directly** — always through `src/lib/api/*`.
- **RLS is not a row filter for "mine".** `team_members` lets you see _every_ membership row of a
  team you belong to (that is what makes member lists work), so queries that mean "my rows" must
  still filter on `user_id` — `listMyTeams()` does, and there is an RLS test pinning the
  behaviour. The same will apply to card assignees in Phase 4.
- **Errors are translated before they reach the UI** (`lib/api/errors.ts`). Raw Postgres messages
  name tables, columns and constraints, so they go to `cause`, never to the user. `withMessages()`
  re-labels a mapped error with wording that fits the operation ("They are already in this team").
- **Query keys live in `lib/api/keys.ts`** and per-user keys include the user id, so switching
  user in development cannot show the previous user's cached rows.
- **All queries and mutations for a feature live in one `use*.ts` hook file**, which is also where
  cache invalidation is decided — a membership change refreshes the member list _and_ the sidebar.
- **The shell heading can be overridden by a page** (`app/pageTitle.ts`): route handles are static
  and cannot carry loaded data. The override is tied to the pathname it came from, so navigating
  drops it without an extra effect. Boards and cards will want the same in Phases 3–5.
- **The sidebar is desktop-only** (`hidden md:flex`), so anything that lives only there is
  unreachable on a phone. That is why `/teams` exists and why "Teams" is in the bottom tab bar.
  The bar carries five items at ~72px, so `nav.ts` has `shortLabel` for the cramped ones while the
  accessible name stays full.
- **Touch targets** are lifted to 44px with Tailwind's `pointer-coarse:` variant in the shared
  primitives, rather than by making everything big on desktop.
- **Ordering is fractional-index strings** (`lib/ordering.ts`, wrapping `fractional-indexing`), so
  a move rewrites one row. ⚠️ Sort with `comparePositions`, never `localeCompare`: the columns are
  `collate "C"` (byte order) and the two disagree on mixed case. `sortByPosition` breaks ties on
  id so concurrent inserts still land in one stable order.
- **The board canvas is ReactFlow** (`features/board-canvas/`). Lists and cards are _separate_
  nodes, not nested: a card has to be able to leave its column, which it cannot do as a child of
  it. Card positions are computed by `layout.ts` and never stored — the database only knows a
  card's list and its fractional index.
  ⚠️ **Node objects are cached and reused while nothing about them changes, and that is load
  bearing.** The proof of concept measured a drag step on a 300-card board at **20–44ms** when
  every node object was rebuilt and **10–11ms** when unchanged cards kept their identity; 44ms is
  three dropped frames per pointer move. `onlyRenderVisibleElements` is a separate fix — it keeps
  the DOM small (300 cards → 36 nodes) but does not reduce the per-step cost.
- **Card heights are computed, not measured** (`cardHeight`). Measuring would mean laying out,
  measuring, then laying out again. The card is then _drawn_ at exactly that height, so the
  estimate is authoritative — otherwise the drop index, which is derived from these heights,
  slowly stops matching what the eye sees down a long list.
- **The card body is the drag surface.** Only the small buttons carry ReactFlow's `nodrag`; the
  title does not, because marking it nodrag left almost nowhere to grab the card. A click that
  travelled more than 4px is treated as a drag, not a tap.
- **Motion:** cards that are not being carried ease to their slot (that is the gap opening and
  closing); the carried card has no transition so it tracks the pointer exactly; on drop the class
  flips back and the same easing settles it into place. All transform-only.
- ⚠️ **There is no `cards → boards` relationship for PostgREST to follow.** `cards.board_id` is
  half of a composite foreign key to `lists(id, board_id)`, so an embed like `cards(boards(...))`
  fails with PGRST200. Reach the board through the list: `cards(lists(boards(...)))`. Pinned by a
  test in `tests/rls/cards.test.ts`.
- **My Tasks filters archived parents in JavaScript**, because PostgREST cannot filter on the
  parent of an embedded row. A card in an archived list keeps `archived = false`, so without that
  filter it would show as live work even though the board does not draw it.
- **Motion lives in `src/styles/index.css`**, not in components: two easing curves
  (`--ease-glide`, `--ease-out-soft`) and three durations, plus `.animate-rise`, `.stagger`,
  `.press` and the board's own card transitions. Everything animates transform and opacity only,
  so it stays on the compositor, and all of it is switched off under `prefers-reduced-motion`.
  Reach for a class rather than writing a new transition.
- **The card sheet is one column at every width** (`components/ui/Sheet.tsx`): full screen on a
  phone, a centred panel from `sm` up. Built on `<dialog>`, so focus trapping, Escape and focus
  restoration come from the browser. It has its own route, `/t/:teamId/b/:boardId/c/:cardId`, so a
  card can be linked to and the back button closes it.
- **Mentions are parsed on the client but filtered on the server.** `add_card_comment` drops any
  mention that is not a member of the board's team — otherwise a crafted request could notify, and
  so confirm the existence of, any account.
- ⚠️ **`Input` and `Select` put `className` on the control, not the wrapper.** Passing `flex-1`
  collapses the field to a zero basis; use `wrapperClassName` (Input) or a wrapping element.
- **Backgrounds are one text column** with a prefix: `color:#rrggbb` or `image:<path>`. Parsing
  lives in `lib/api/boards.ts`; anything unrecognised renders as the default surface.
- **The dev switcher cannot ship.** It is behind `import.meta.env.DEV` and loaded with `lazy()`,
  and `src/lib/env.ts` reads env vars one at a time rather than passing `import.meta.env` as an
  object (which would inline every `VITE_*` value into the production bundle). Verified: a
  production build contains no test email, no dev password and no switcher code.

---

## Testing

| Command            | What it covers                                                                |
| ------------------ | ----------------------------------------------------------------------------- |
| `npm run check`    | typecheck + lint + format check + unit/component tests (53 tests)             |
| `npm run test:rls` | **Row Level Security against the dev Supabase project** (43) — needs the seed |
| `npm run e2e`      | Playwright, production preview build, signed out (12, desktop + Pixel 7)      |

- `tests/rls/isolation.test.ts` — an outsider cannot read or write anything, a member cannot
  escalate, an admin cannot touch the owner, identity fields cannot be forged.
- `tests/rls/team-members.test.ts` — the Phase 2 RPCs, asserted on real error codes. Because they
  are `security definer`, network tests are the only proof the checks exist.
- `tests/rls/boards.test.ts` — boards, private boards, archiving, lists and the storage bucket,
  including a real upload and a fetch of the public URL to prove the bucket is not public.
- `tests/rls/cards.test.ts` — the card RPCs: who may add and move, and that a card can never be
  moved onto another board.
- `tests/rls/card-detail.test.ts` — who may be assigned, whose mentions are honoured, that a copy
  cannot cross boards, and the attachment bucket.
  ⚠️ All three files share the seeded fixture, so **anything a test changes it must put back**:
  Product must end as ada (owner), grace (admin), linus (member), with "Roadmap" the only board.
  Cleanup happens in `afterEach`; running the suite twice in a row is the check that it works.
  Deleting a scratch board needs both halves of the rule — only an admin may delete, and only
  someone who can see the board may target it — so `boards.test.ts` tries the creator then an
  admin.
- Component tests mock `@/lib/api/*` and render the real router through `src/test/renderApp.tsx`,
  which stubs the auth state. They assert the interface does not offer an action the server would
  refuse, nor hide one it would allow.
- The RLS suites skip themselves when the env vars are absent.

Migrations are also executed in an in-process Postgres (PGlite) in the scratchpad before being
pushed — 45 policy assertions for Phase 1, 31 for Phase 2, 45 for Phase 3, 21 for Phase 4, 38 for Phase 5. That is how the
`create_team` and `set_board_visibility` RETURNING bugs were both found before they reached the
database. The harness is **not** in the repo; it could be added as a no-network RLS
test if wanted (costs a ~30 MB dev dependency).

---

## Conventions

- Prettier (no semicolons, single quotes, width 100, Tailwind class sorting) and oxlint must both
  be clean; `npm run check` is the gate.
- Comments explain _why_, not _what_. Match the density of the surrounding code.
- Every new table gets RLS on, policies `to authenticated`, and a matching RLS test.
- Any multi-row write goes in a Postgres function, not several client round trips.
- Mobile-first: check 360 / 768 / 1280 px, touch targets ≥ 44 px, no horizontal overflow.

---

## Next: Phase 7 — Realtime & in-app notifications

Scope from the plan: Supabase Realtime channels per board, cache updates from those events, a
notification bell and inbox on the `notifications` rows, read/unread, and an activity feed. Done
when two browsers signed in as different users see each other's changes live.

Already in place:

- Every RPC since Phase 2 writes `notifications` and `activity` rows already, so the inbox has
  real data to show the moment it is built — nothing else needs to change server-side.
- `notifications` has `select` and `update` grants for the owner only (marking read), and no
  insert grant at all, so a client can never forge one.
- `queryKeys` is the single place to invalidate from when a Realtime event arrives.

Still needed:

- Tables must be added to the `supabase_realtime` publication; that was deliberately left to this
  phase.
- The bell belongs in `AppShell`; "Inbox" is already the mobile tab label for `/notifications`.
- ⚠️ Realtime respects RLS, but a board channel is per board — take care that leaving a team or a
  private board unsubscribes, or a stale channel keeps pushing rows the user can no longer read.

---

## Known gaps

- **Ownership transfer** does not exist: a team's owner row is immutable, so a team cannot change
  hands. Decide before Phase 11.
- **A private board its members all leave** becomes invisible and can only be removed with the
  team — a team admin cannot delete a board they cannot see. Pinned by a test.
- **Cards in an archived list disappear from the board** but stay `archived = false`. Harmless
  today; ⚠️ Phase 6's My Tasks must exclude them, or they will show up as live work.
- **Touch long-press to drag** is still the one behaviour that cannot be exercised here; check it
  on a phone.
