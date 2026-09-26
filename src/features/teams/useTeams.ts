import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { queryKeys } from '@/lib/api/keys'
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeam,
  listMyTeams,
  listTeamMembers,
  removeTeamMember,
  setTeamMemberRole,
  updateTeam,
  type AddTeamMemberInput,
  type NewTeam,
  type SetTeamMemberRoleInput,
  type TeamPatch,
  type TeamRole,
} from '@/lib/api/teams'

/**
 * Queries and mutations for teams and their members.
 *
 * Every mutation invalidates through `queryKeys`, so a membership change refreshes both the
 * member list and the sidebar — a member who removes themselves must lose the team immediately.
 */

function invalidateTeam(client: QueryClient, teamId: string, userId: string | null) {
  void client.invalidateQueries({ queryKey: queryKeys.teamMembers(teamId) })
  void client.invalidateQueries({ queryKey: queryKeys.team(teamId) })
  if (userId) void client.invalidateQueries({ queryKey: queryKeys.myTeams(userId) })
}

export function useMyTeams() {
  const { status, user } = useAuth()
  const userId = user?.id
  return useQuery({
    queryKey: queryKeys.myTeams(userId ?? ''),
    queryFn: ({ signal }) => listMyTeams(userId as string, signal),
    enabled: status === 'signed-in' && Boolean(userId),
  })
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.team(teamId ?? ''),
    queryFn: ({ signal }) => getTeam(teamId as string, signal),
    enabled: Boolean(teamId),
  })
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teamMembers(teamId ?? ''),
    queryFn: ({ signal }) => listTeamMembers(teamId as string, signal),
    enabled: Boolean(teamId),
  })
}

/** The signed-in user's role in a team, or null while loading or when they are not a member. */
export function useMyRole(teamId: string | undefined): TeamRole | null {
  const teams = useMyTeams()
  if (!teamId || !teams.data) return null
  return teams.data.find((membership) => membership.team.id === teamId)?.role ?? null
}

export function useCreateTeam() {
  const client = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: NewTeam) => createTeam(input),
    onSuccess: () => {
      if (user?.id) void client.invalidateQueries({ queryKey: queryKeys.myTeams(user.id) })
    },
  })
}

export function useUpdateTeam(teamId: string) {
  const client = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (patch: TeamPatch) => updateTeam(teamId, patch),
    onSuccess: () => invalidateTeam(client, teamId, user?.id ?? null),
  })
}

export function useDeleteTeam() {
  const client = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (teamId: string) => deleteTeam(teamId),
    onSuccess: (_result, teamId) => {
      client.removeQueries({ queryKey: queryKeys.team(teamId) })
      client.removeQueries({ queryKey: queryKeys.teamMembers(teamId) })
      if (user?.id) void client.invalidateQueries({ queryKey: queryKeys.myTeams(user.id) })
    },
  })
}

export function useAddTeamMember(teamId: string) {
  const client = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: Omit<AddTeamMemberInput, 'teamId'>) => addTeamMember({ ...input, teamId }),
    onSuccess: () => invalidateTeam(client, teamId, user?.id ?? null),
  })
}

export function useSetTeamMemberRole(teamId: string) {
  const client = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: Omit<SetTeamMemberRoleInput, 'teamId'>) =>
      setTeamMemberRole({ ...input, teamId }),
    onSuccess: () => invalidateTeam(client, teamId, user?.id ?? null),
  })
}

export function useRemoveTeamMember(teamId: string) {
  const client = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSuccess: () => invalidateTeam(client, teamId, user?.id ?? null),
  })
}
