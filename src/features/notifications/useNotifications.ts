import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { queryKeys } from '@/lib/api/keys'
import { countUnread, listNotifications, markRead } from '@/lib/api/notifications'
import { supabase } from '@/lib/supabase'

export function useNotifications(unreadOnly = false) {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.notifications(unreadOnly),
    queryFn: ({ signal }) => listNotifications({ unreadOnly }, signal),
    enabled: status === 'signed-in',
  })
}

export function useUnreadCount() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: ({ signal }) => countUnread(signal),
    enabled: status === 'signed-in',
  })
}

export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids?: number[]) => markRead(ids),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.notifications(false) })
      void client.invalidateQueries({ queryKey: queryKeys.notifications(true) })
      void client.invalidateQueries({ queryKey: queryKeys.unreadCount })
    },
  })
}

/**
 * Keeps the bell and the inbox current without polling.
 *
 * The channel carries only this user's rows — Realtime applies the same RLS policy the query
 * does, and `notifications` is `user_id = auth.uid()`. The handler only invalidates: trusting a
 * pushed payload to update the cache directly would mean two code paths for one shape of data,
 * and the refetch is a single small query.
 */
export function useNotificationsRealtime() {
  const { status, user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  useEffect(() => {
    const client = supabase
    if (status !== 'signed-in' || !userId || !client) return

    const channel = client
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount })
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(false) })
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(true) })
        },
      )
      .subscribe()

    // Unsubscribing on sign-out matters: a channel left open would keep pushing rows for an
    // account that is no longer the one using this tab.
    return () => {
      void client.removeChannel(channel)
    }
  }, [status, userId, queryClient])
}
