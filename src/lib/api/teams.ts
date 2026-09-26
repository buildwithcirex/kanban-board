import { requireSupabase } from '@/lib/supabase'
import type { Enums, Tables, TablesUpdate } from '@/types/database.types'
import { AppError, toAppError, unwrap, withMessages } from './errors'

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

/** One team, or a not-found error when it does not exist or the caller cannot see it. */
export async function getTeam(teamId: string, signal?: AbortSignal): Promise<Team> {
  let query = requireSupabase().from('teams').select('*').eq('id', teamId)
  if (signal) query = query.abortSignal(signal)
  return unwrap(await query.single())
}

export type TeamPatch = {
  name?: string
  description?: string | null
  color?: string
}

/** Rename or restyle a team. RLS restricts this to owners and admins. */
export async function updateTeam(teamId: string, patch: TeamPatch): Promise<Team> {
  const update: TablesUpdate<'teams'> = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.description !== undefined) update.description = patch.description?.trim() || null
  if (patch.color !== undefined) update.color = patch.color

  const result = await requireSupabase()
    .from('teams')
    .update(update)
    .eq('id', teamId)
    .select()
    .single()

  if (result.error) {
    throw withMessages(result.error, {
      'not-found': 'Only the team owner or an admin can change the team.',
    })
  }
  return result.data
}

/** Deletes a team and everything in it. RLS restricts this to the owner. */
export async function deleteTeam(teamId: string): Promise<void> {
  const result = await requireSupabase().from('teams').delete().eq('id', teamId).select('id')
  if (result.error) throw toAppError(result.error)
  if ((result.data ?? []).length === 0) {
    throw new AppError('forbidden', 'Only the team owner can delete this team.')
  }
}

export type AddTeamMemberInput = {
  teamId: string
  email: string
  role?: Exclude<TeamRole, 'owner'>
}

/**
 * Adds an existing account to the team by email.
 *
 * Until Phase 11 adds email invites there is no way to reach someone without an account, so an
 * unknown address is an error rather than a pending invitation.
 */
export async function addTeamMember(input: AddTeamMemberInput): Promise<void> {
  const { error } = await requireSupabase().rpc('add_team_member', {
    p_team_id: input.teamId,
    p_email: input.email.trim(),
    ...(input.role ? { p_role: input.role } : {}),
  })
  if (error) {
    throw withMessages(error, {
      'not-found': 'No account uses that email address yet.',
      conflict: 'They are already in this team.',
      forbidden: 'Only the team owner or an admin can add members.',
      invalid: 'That email address or role is not valid.',
    })
  }
}

export type SetTeamMemberRoleInput = {
  teamId: string
  userId: string
  role: Exclude<TeamRole, 'owner'>
}

export async function setTeamMemberRole(input: SetTeamMemberRoleInput): Promise<void> {
  const { error } = await requireSupabase().rpc('set_team_member_role', {
    p_team_id: input.teamId,
    p_user_id: input.userId,
    p_role: input.role,
  })
  if (error) {
    throw withMessages(error, {
      forbidden: "Only admins can change roles, and the owner's role is fixed.",
      'not-found': 'They are no longer a member of this team.',
    })
  }
}

/** Removes a member. Passing your own id is how you leave a team. */
export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('remove_team_member', {
    p_team_id: teamId,
    p_user_id: userId,
  })
  if (error) {
    throw withMessages(error, {
      forbidden: 'The owner cannot be removed — delete the team instead.',
      'not-found': 'They are no longer a member of this team.',
    })
  }
}
