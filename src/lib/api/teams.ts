import { requireSupabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database.types'
import { unwrap } from './errors'

export type Team = Tables<'teams'>
export type TeamRole = Enums<'team_role'>

export type TeamMembership = {
  team: Team
  role: TeamRole
}

export type TeamMember = {
  userId: string
  role: TeamRole
  name: string
  email: string
  avatarUrl: string | null
  color: string
}

type MembershipRow = {
  role: TeamRole
  teams: Team | null
}

/**
 * The teams the given user belongs to, with their own role in each.
 *
 * The `user_id` filter is load-bearing. RLS on `team_members` grants sight of *every* membership
 * row of a team you belong to — that is what makes the member list work — so without it this
 * returns one row per teammate and the same team appears several times.
 */
export async function listMyTeams(userId: string, signal?: AbortSignal): Promise<TeamMembership[]> {
  let query = requireSupabase().from('team_members').select('role, teams(*)').eq('user_id', userId)
  if (signal) query = query.abortSignal(signal)

  const rows = unwrap(await query.returns<MembershipRow[]>())

  return rows
    .filter((row): row is MembershipRow & { teams: Team } => row.teams !== null)
    .map((row) => ({ team: row.teams, role: row.role }))
    .sort((a, b) => a.team.name.localeCompare(b.team.name))
}

type MemberRow = {
  user_id: string
  role: TeamRole
  profiles: Pick<Tables<'profiles'>, 'name' | 'email' | 'avatar_url' | 'color'> | null
}

/** Members of one team, with their profile. Non-members get an empty list from RLS. */
export async function listTeamMembers(teamId: string, signal?: AbortSignal): Promise<TeamMember[]> {
  let query = requireSupabase()
    .from('team_members')
    .select('user_id, role, profiles(name, email, avatar_url, color)')
    .eq('team_id', teamId)
  if (signal) query = query.abortSignal(signal)

  const rows = unwrap(await query.returns<MemberRow[]>())

  return rows
    .map((row) => ({
      userId: row.user_id,
      role: row.role,
      name: row.profiles?.name ?? 'Unknown member',
      email: row.profiles?.email ?? '',
      avatarUrl: row.profiles?.avatar_url ?? null,
      color: row.profiles?.color ?? '#4b7bec',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export type NewTeam = {
  name: string
  description?: string | null
  color?: string | null
}

/**
 * Creates a team owned by the caller.
 *
 * This goes through the `create_team` RPC rather than an insert: the team and its owner
 * membership have to land in one transaction, and a plain `insert ... select()` cannot read the
 * new row back — the SELECT policy needs a membership that does not exist yet at that moment.
 */
export async function createTeam(input: NewTeam): Promise<Team> {
  // The RPC's optional arguments have SQL defaults, so omit them rather than sending null.
  const { data, error } = await requireSupabase().rpc('create_team', {
    p_name: input.name.trim(),
    ...(input.description ? { p_description: input.description } : {}),
    ...(input.color ? { p_color: input.color } : {}),
  })
  return unwrap({ data, error })
}
