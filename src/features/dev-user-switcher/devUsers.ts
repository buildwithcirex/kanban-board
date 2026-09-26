/**
 * The users created by supabase/seed.sql. Development only — this module is behind an
 * `import.meta.env.DEV` boundary and is not part of a production build.
 */
export type DevUser = {
  email: string
  name: string
  /** Where they sit in the seeded teams, so the effect of RLS is obvious while switching. */
  hint: string
}

export const devUsers: DevUser[] = [
  { email: 'ada@kanban.test', name: 'Ada Lovelace', hint: 'Owner · Product' },
  { email: 'grace@kanban.test', name: 'Grace Hopper', hint: 'Admin · Product' },
  { email: 'linus@kanban.test', name: 'Linus Torvalds', hint: 'Member · Product' },
  { email: 'mallory@kanban.test', name: 'Mallory Quinn', hint: 'Outsider · no shared team' },
]
