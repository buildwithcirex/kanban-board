/**
 * Every TanStack Query key in the app is built here, so cache invalidation after a mutation can
 * never miss a query because two places spelled the same key differently.
 */
export const queryKeys = {
  session: ['session'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  myTeams: (userId: string) => ['teams', 'mine', userId] as const,
  teamMembers: (teamId: string) => ['teams', teamId, 'members'] as const,
  supabaseHealth: ['supabase-health'] as const,
} as const
