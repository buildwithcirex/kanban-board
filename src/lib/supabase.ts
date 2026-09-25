import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Null when .env.local is missing or invalid. The shell shows a configuration
 * banner in that case instead of crashing.
 */
export const supabase: SupabaseClient | null = env.ok
  ? createClient(env.value.supabaseUrl, env.value.supabaseAnonKey)
  : null

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
