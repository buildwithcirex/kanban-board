import { requireSupabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { unwrap } from './errors'

export type Profile = Tables<'profiles'>

/** The signed-in user's own profile row. Created by a trigger when the auth user is created. */
export async function getMyProfile(userId: string, signal?: AbortSignal): Promise<Profile> {
  let query = requireSupabase().from('profiles').select('*').eq('id', userId)
  if (signal) query = query.abortSignal(signal)
  return unwrap(await query.single())
}

export type ProfileUpdate = {
  name?: string
  avatarUrl?: string | null
  color?: string
}

/**
 * Updates the caller's own profile. `id` and `email` are rejected by the database
 * (`profiles_protect_identity`), so only presentational fields are sent.
 */
export async function updateMyProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
  return unwrap(
    await requireSupabase()
      .from('profiles')
      .update({
        ...(update.name !== undefined ? { name: update.name.trim() } : {}),
        ...(update.avatarUrl !== undefined ? { avatar_url: update.avatarUrl } : {}),
        ...(update.color !== undefined ? { color: update.color } : {}),
      })
      .eq('id', userId)
      .select()
      .single(),
  )
}
