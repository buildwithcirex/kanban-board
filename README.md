# Kanban

Team Kanban board (Trello-style) with assignments, a ReactFlow board canvas, PWA install and Android push notifications. Backend: Supabase.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for architecture and phases.

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

**Settings → Backend** in the app shows whether the connection works.

### Supabase CLI (for database migrations, from Phase 1)

The CLI is installed as a dev dependency. It does not need Docker for the commands we use.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push    # apply supabase/migrations to the linked project
npm run db:types   # regenerate src/types/database.types.ts
```

## Scripts

| Script                                    | What it does                                   |
| ----------------------------------------- | ---------------------------------------------- |
| `npm run dev`                             | Vite dev server                                |
| `npm run build`                           | Typecheck + production build                   |
| `npm run check`                           | Typecheck, lint, format check and unit tests   |
| `npm test` / `npm run test:watch`         | Vitest unit and component tests                |
| `npm run e2e`                             | Playwright tests (desktop + Pixel 7 viewports) |
| `npm run lint`                            | oxlint (React, a11y, TypeScript rules)         |
| `npm run format` / `npm run format:check` | Prettier (with Tailwind class sorting)         |

First Playwright run: `npx playwright install chromium`.

## Structure

```
src/
  app/            shell, routes, error/404 pages
  components/ui/  shared UI primitives (Button, Input, Dialog, ...)
  features/       one folder per product area
  lib/            env, Supabase client, theme, utilities
  styles/         Tailwind entry + design tokens (light/dark)
supabase/         CLI config, migrations (Phase 1+), edge functions (Phase 8)
tests/e2e/        Playwright
```
