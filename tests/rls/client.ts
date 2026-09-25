import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'

/**
 * Helpers for the Row Level Security suite. These talk to the **dev** Supabase project over the
 * network using the public anon key and real password sign-ins, which is the only way to prove
 * that the policies — not the client code — are what keeps teams apart.
 */

export const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
export const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
export const devPassword = process.env.VITE_DEV_USER_PASSWORD ?? ''

/** True when the dev project and seeded users are configured; the suite skips itself otherwise. */
export const rlsSuiteEnabled = Boolean(supabaseUrl && anonKey && devPassword)

export const testUsers = {
  ada: 'ada@kanban.test',
  grace: 'grace@kanban.test',
  linus: 'linus@kanban.test',
  mallory: 'mallory@kanban.test',
} as const

export type TestUserKey = keyof typeof testUsers

export type TestClient = {
  db: SupabaseClient<Database>
  userId: string
  email: string
}

function newClient(): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** A client with no session at all — what an attacker holding only the public anon key has. */
export function anonClient(): SupabaseClient<Database> {
  return newClient()
}

export async function signInAs(user: TestUserKey): Promise<TestClient> {
  const db = newClient()
  const email = testUsers[user]
  const { data, error } = await db.auth.signInWithPassword({ email, password: devPassword })
  if (error || !data.user) {
    throw new Error(
      `Could not sign in as ${email}: ${error?.message ?? 'no user returned'}. ` +
        'Run supabase/seed.sql against the dev project first.',
    )
  }
  return { db, userId: data.user.id, email }
}

export async function signOutAll(clients: TestClient[]): Promise<void> {
  await Promise.all(clients.map((client) => client.db.auth.signOut()))
}
