# Kanban

Team Kanban board (Trello-style) with assignments, a ReactFlow board canvas, PWA install and Android push notifications. Backend: Supabase.

[context.md](context.md) is the current state of the project — read it first.
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) has the architecture and the phases.

## Setup

Requirements: Node 22+.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:5173
```

`.env.local` needs, from Supabase Dashboard → Project Settings → API:

- `VITE_SUPABASE_URL`: the project URL
- `VITE_SUPABASE_ANON_KEY`: the **anon / public** key (never the `service_role` key)
- `VITE_DEV_USER_PASSWORD`: development only — the password of the seeded test users. Vite strips
  it from production builds.

**Settings → Backend** in the app shows whether the connection works.

### Database setup

The Supabase CLI is installed as a dev dependency and needs no Docker for the commands we use.

```bash
npx supabase login
npx supabase link --project-ref <your-dev-project-ref>
npm run db:push    # apply supabase/migrations to the linked project
npm run db:types   # regenerate src/types/database.types.ts from the live schema
```

Then seed the test users: **Supabase Dashboard → SQL Editor**, paste `supabase/seed.sql`, Run.
It is idempotent and creates four confirmed users who share `VITE_DEV_USER_PASSWORD`:

| User                | In the seeded data                                             |
| ------------------- | -------------------------------------------------------------- |
| ada@kanban.test     | owner of "Product"                                             |
| grace@kanban.test   | admin of "Product"                                             |
| linus@kanban.test   | member of "Product"                                            |
| mallory@kanban.test | owner of "Outsiders" — shares no team, used to prove isolation |

**Never run the seed against production.**

### Signing in

There are no login screens until Phase 11. In development, a user switcher in the header signs in
as one of the seeded users with real Supabase Auth, so Row Level Security applies exactly as it
will in production. It is compiled out of production builds.

## Scripts

| Script                                    | What it does                                     |
| ----------------------------------------- | ------------------------------------------------ |
| `npm run dev`                             | Vite dev server                                  |
| `npm run build`                           | Typecheck + production build                     |
| `npm run check`                           | Typecheck, lint, format check and unit tests     |
| `npm test` / `npm run test:watch`         | Vitest unit and component tests                  |
| `npm run test:rls`                        | Row Level Security suite against the dev project |
| `npm run e2e`                             | Playwright tests (desktop + Pixel 7 viewports)   |
| `npm run lint`                            | oxlint (React, a11y, TypeScript rules)           |
| `npm run format` / `npm run format:check` | Prettier (with Tailwind class sorting)           |

First Playwright run: `npx playwright install chromium`.

## Structure

```
src/
  app/            shell, routes, error/404 pages
  components/ui/  shared UI primitives (Button, Input, Dialog, ...)
  features/       one folder per product area
  lib/            env, Supabase client, api/* (typed data access), theme, utilities
  types/          database.types.ts (regenerate with npm run db:types)
  styles/         Tailwind entry + design tokens (light/dark)
supabase/
  migrations/     hand-written SQL: schema, RLS, triggers, RPCs
  seed.sql        development test users, teams and a sample board
tests/e2e/        Playwright
tests/rls/        Row Level Security suite (network, dev project)
```
