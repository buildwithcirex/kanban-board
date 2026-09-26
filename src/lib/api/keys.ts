/**
 * Every TanStack Query key in the app is built here, so cache invalidation after a mutation can
 * never miss a query because two places spelled the same key differently.
 */
export const queryKeys = {
  session: ['session'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  myTeams: (userId: string) => ['teams', 'mine', userId] as const,
  team: (teamId: string) => ['teams', teamId] as const,
  teamMembers: (teamId: string) => ['teams', teamId, 'members'] as const,
  teamBoards: (teamId: string, archived: boolean) =>
    ['teams', teamId, 'boards', { archived }] as const,
  allBoards: ['boards', 'all'] as const,
  board: (boardId: string) => ['boards', boardId] as const,
  boardMembers: (boardId: string) => ['boards', boardId, 'members'] as const,
  boardLists: (boardId: string, archived: boolean) =>
    ['boards', boardId, 'lists', { archived }] as const,
  boardBackground: (path: string) => ['background', path] as const,
  supabaseHealth: ['supabase-health'] as const,
} as const
