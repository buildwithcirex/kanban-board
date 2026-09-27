import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/keys'
import { supabase } from '@/lib/supabase'

/**
 * Keeps an open board in step with everyone else looking at it.
 *
 * Realtime applies the same RLS policies the queries do, so a subscriber is only sent rows they
 * could have read anyway — a private board they are not on produces no events for them.
 *
 * The handlers only invalidate rather than patching the cache from the payload. A payload is a
 * raw table row, not the shape the board renders (a card carries its assignees and labels), so
 * applying it directly would mean maintaining two mappings of the same data. Refetching one
 * board's cards is cheap, and it cannot drift.
 *
 * ⚠️ `cards` and `lists` are filtered server-side to this board. Without the filter every client
 * would be woken by every change in the whole database that they can see.
 */
export function useBoardRealtime(boardId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const client = supabase
    if (!boardId || !client) return

    const refreshCards = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardCards(boardId, false) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardCards(boardId, true) })
    }
    const refreshLists = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardLists(boardId, false) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardLists(boardId, true) })
    }

    const channel = client
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        refreshCards,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lists', filter: `board_id=eq.${boardId}` },
        refreshLists,
      )
      // Assignees have no board column to filter on, so this one is board-wide and the handler
      // simply refreshes the cards; the alternative is a filter per card.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'card_assignees' },
        refreshCards,
      )
      .subscribe()

    // Leaving the board, or losing access to it, must close the channel: a stale subscription
    // keeps a socket open and keeps refetching a board that is no longer on screen.
    return () => {
      void client.removeChannel(channel)
    }
  }, [boardId, queryClient])
}
