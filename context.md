# Project context

Read this first. It is the current state of the project in one file, kept up to date as work
happens, so a fresh session does not have to reverse-engineer the repo.

- **What this is:** a team Kanban board (Trello clone) on Supabase. Trello is the product
  reference: where behaviour is unspecified, do what Trello does.
- **The plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — architecture, domain
  model and the 12 phases. It is the contract for technology choices; do not deviate from it.
- **Last updated:** 2026-09-26 — Phase 1 done and verified against the live dev project.

---

## Where we are

| Phase                               | Status                                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| 0 — Foundation                      | ✅ done                                                            |
| 1 — Schema, RLS & dev users         | ✅ done — migrations pushed, seeded, sign-in and RLS verified live |
| 2 — Teams & members                 | ⬜ next                                                            |
| 3 — Boards & lists                  | ⬜                                                                 |
| 4 — ReactFlow Kanban                | ⬜                                                                 |
| 5 — Card detail                     | ⬜                                                                 |
| 6 — My Tasks & team views           | ⬜                                                                 |
| 7 — Realtime & in-app notifications | ⬜                                                                 |
| 8 — PWA + Android push              | ⬜                                                                 |
| 9 — Extra views & productivity      | ⬜                                                                 |
| 10 — Hardening & deploy             | ⬜                                                                 |
| 11 — Authentication UI              | ⬜ (last, on purpose)                                              |

### Database state

The dev project is **linked, migrated and seeded**. Sign-in works and `npm run test:rls` passes
(22 tests) against it. `src/types/database.types.ts` is now generated from the live schema.

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

| File                       | Contents                                                                        |
| -------------------------- | ------------------------------------------------------------------------------- |
| `…090000_core_schema.sql`  | 5 enums, 19 tables, indexes, `updated_at` triggers, RLS switched on everywhere  |
| `…090100_rls_helpers.sql`  | Privilege grants + 14 `security definer` authorization helpers                  |
| `…090200_rls_policies.sql` | 65 policies, all `to authenticated`                                             |
| `…090300_triggers.sql`     | Profile-on-signup, email sync, team-owner membership, `created_by` immutability |
| `…090400_team_rpcs.sql`    | `create_team(name, description, color)` RPC                                     |

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

### App code

```
src/
  app/          AppShell (nav, theme, AuthGate), routes, 404, error boundary
  components/ui Button, IconButton, Input, Dialog, Spinner, EmptyState, Page
  features/
    auth/               AuthContext, AuthProvider (owns the Supabase session), useAuth
    dev-user-switcher/  DEV-ONLY sign-in as a seeded user
    teams/              TeamNav (sidebar list of your teams)
    boards|my-tasks|notifications|settings/  placeholder pages
  lib/
    api/        errors.ts (UI-safe error mapping), keys.ts (query keys), teams.ts, profiles.ts
    env.ts      zod-validated env; also parses the DEV-only password
    supabase.ts typed client (PKCE, auto-refresh)
    theme.ts    light/dark, applied before first paint
  types/database.types.ts   hand-written to match the migrations; regenerate with npm run db:types
```

- **Nothing renders without a session.** `AuthGate` in the shell gates every route except those
  whose route handle says `public: true` (only the 404 page today).
- **Components never call Supabase directly** — always through `src/lib/api/*`.
- **RLS is not a row filter for "mine".** `team_members` lets you see _every_ membership row of a
  team you belong to (that is what makes member lists work), so queries that mean "my rows" must
  still filter on `user_id` — `listMyTeams()` does, and there is an RLS test pinning the
  behaviour. The same will apply to card assignees in Phase 4.
- **Errors are translated before they reach the UI** (`lib/api/errors.ts`). Raw Postgres messages
  name tables, columns and constraints, so they go to `cause`, never to the user.
- **The dev switcher cannot ship.** It is behind `import.meta.env.DEV` and loaded with `lazy()`,
  and `src/lib/env.ts` reads env vars one at a time rather than passing `import.meta.env` as an
  object (which would inline every `VITE_*` value into the production bundle). Verified: a
  production build contains no test email, no dev password and no switcher code.

---

## Testing

| Command            | What it covers                                                           |
| ------------------ | ------------------------------------------------------------------------ |
| `npm run check`    | typecheck + lint + format check + unit/component tests (29 tests)        |
| `npm run test:rls` | **Row Level Security against the dev Supabase project** — needs the seed |
| `npm run e2e`      | Playwright, production preview build, signed out (desktop + Pixel 7)     |

`tests/rls/isolation.test.ts` signs in as each seeded user over the network and asserts that an
outsider cannot read or write anything, a member cannot escalate, an admin cannot touch the owner,
and identity fields cannot be forged. It skips itself when the env vars are absent.

During Phase 1 the migrations were additionally executed in an in-process Postgres (PGlite) in the
scratchpad, with 45 policy assertions — that is how the `create_team` RETURNING bug was found. That
harness is **not** in the repo; it could be added as a no-network RLS test if wanted (costs a
~30 MB dev dependency).

---

## Conventions

- Prettier (no semicolons, single quotes, width 100, Tailwind class sorting) and oxlint must both
  be clean; `npm run check` is the gate.
- Comments explain _why_, not _what_. Match the density of the surrounding code.
- Every new table gets RLS on, policies `to authenticated`, and a matching RLS test.
- Any multi-row write goes in a Postgres function, not several client round trips.
- Mobile-first: check 360 / 768 / 1280 px, touch targets ≥ 44 px, no horizontal overflow.

---

## Next: Phase 2 — Teams & members

Scope from the plan: create a team, add/remove members, change roles, team switcher, team page.
Done when switching user changes which teams are visible.

Already in place for it: `create_team` RPC and `createTeam()`, `listMyTeams()`,
`listTeamMembers()`, `queryKeys`, and the sidebar `TeamNav`. Still needed: a team page and route
(`/t/:teamId`), the create-team dialog, member add/remove/role UI (admins only), and an
`add_team_member` path that resolves a user by email — note that until Phase 11 there are no
invites, so Phase 2 can only add users who already exist.
