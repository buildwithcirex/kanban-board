import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { env } from './env'

export type Client = SupabaseClient<Database>

/**
 * Null when .env.local is missing or invalid. The shell shows a configuration
 * banner in that case instead of crashing.
 *
 * Only the anon key is ever used here. Every read and write is gated by Row Level Security in
 * Postgres, so the key alone grants nothing until a user signs in.
 */
export const supabase: Client | null = env.ok
  ? createClient<Database>(env.value.supabaseUrl, env.value.supabaseAnonKey, {
      auth: {
        // PKCE keeps the auth code exchange safe on a public client.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'kb-auth',
      },
      global: { headers: { 'x-client-info': 'kanban-web' } },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

/** Narrowed accessor for code paths that cannot run without configuration. */
export function requireSupabase(): Client {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

export type HealthStatus = { reachable: true } | { reachable: false; reason: string }

/** Pings the Supabase Auth health endpoint; works before any tables exist. */
export async function checkSupabaseHealth(signal?: AbortSignal): Promise<HealthStatus> {
  if (!env.ok) return { reachable: false, reason: 'Supabase is not configured' }
  try {
    const response = await fetch(`${env.value.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: env.value.supabaseAnonKey },
      signal,
    })
    if (!response.ok) {
      return { reachable: false, reason: `Supabase responded with HTTP ${response.status}` }
    }
    return { reachable: true }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return { reachable: false, reason: 'Could not reach Supabase (network error)' }
  }
}
