import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/keys'
import {
  createCard,
  deleteCard,
  listBoardCards,
  moveCard,
  updateCard,
  type BoardCard,
  type CardMove,
  type CardPatch,
  type NewCard,
} from '@/lib/api/cards'

/** Archiving moves a card between the two views, so both are invalidated. */
function invalidateCards(client: QueryClient, boardId: string) {
  void client.invalidateQueries({ queryKey: queryKeys.boardCards(boardId, false) })
  void client.invalidateQueries({ queryKey: queryKeys.boardCards(boardId, true) })
}

export function useBoardCards(boardId: string | undefined, archived = false) {
  return useQuery({
    queryKey: queryKeys.boardCards(boardId ?? '', archived),
    queryFn: ({ signal }) => listBoardCards(boardId as string, { archived }, signal),
    enabled: Boolean(boardId),
  })
}

export function useCreateCard(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewCard) => createCard(input),
    onSuccess: () => invalidateCards(client, boardId),
  })
}

/**
 * Moving a card, applied to the cache before the server answers.
 *
 * A drop that waited for a round trip would snap the card back to where it was for a few hundred
 * milliseconds, which reads as a bug. On failure the previous cache is restored, which is the
 * "animates back" behaviour the plan asks for, and the error is surfaced by the caller.
 */
export function useMoveCard(boardId: string) {
  const client = useQueryClient()
  const key = queryKeys.boardCards(boardId, false)

  return useMutation({
    mutationFn: (move: CardMove) => moveCard(move),
    onMutate: async (move) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<BoardCard[]>(key)

      client.setQueryData<BoardCard[]>(key, (cards) =>
        (cards ?? []).map((card) =>
          card.id === move.cardId
            ? { ...card, list_id: move.listId, position: move.position }
            : card,
        ),
      )

      return { previous }
    },
    onError: (_error, _move, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
    },
    // Re-read either way: another person may have moved something in the meantime.
    onSettled: () => invalidateCards(client, boardId),
  })
}

export function useUpdateCard(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, patch }: { cardId: string; patch: CardPatch }) =>
      updateCard(cardId, patch),
    onSuccess: () => invalidateCards(client, boardId),
  })
}

export function useDeleteCard(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (cardId: string) => deleteCard(cardId),
    onSuccess: () => invalidateCards(client, boardId),
  })
}
