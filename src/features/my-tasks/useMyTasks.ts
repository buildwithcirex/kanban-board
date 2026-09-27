import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { queryKeys } from '@/lib/api/keys'
import { getTeamWorkload, listMyTasks } from '@/lib/api/myTasks'

export function useMyTasks() {
  const { status, user } = useAuth()
  const userId = user?.id
  return useQuery({
    queryKey: queryKeys.myTasks(userId ?? ''),
    queryFn: ({ signal }) => listMyTasks(userId as string, signal),
    enabled: status === 'signed-in' && Boolean(userId),
  })
}

export function useTeamWorkload(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teamWorkload(teamId ?? ''),
    // `now` is read at fetch time rather than passed in, so the overdue count is not frozen to
    // whenever the component first rendered.
    queryFn: ({ signal }) => getTeamWorkload(teamId as string, new Date(), signal),
    enabled: Boolean(teamId),
  })
}
