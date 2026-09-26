import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/keys'
import {
  createList,
  deleteList,
  listBoardLists,
  updateList,
  type ListPatch,
  type NewList,
} from '@/lib/api/lists'

/** Both views are invalidated: archiving moves a list from one query to the other. */
function invalidateLists(client: QueryClient, boardId: string) {
  void client.invalidateQueries({ queryKey: queryKeys.boardLists(boardId, false) })
  void client.invalidateQueries({ queryKey: queryKeys.boardLists(boardId, true) })
}

export function useBoardLists(boardId: string | undefined, archived = false) {
  return useQuery({
    queryKey: queryKeys.boardLists(boardId ?? '', archived),
    queryFn: ({ signal }) => listBoardLists(boardId as string, { archived }, signal),
    enabled: Boolean(boardId),
  })
}

export function useCreateList(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<NewList, 'boardId'>) => createList({ ...input, boardId }),
    onSuccess: () => invalidateLists(client, boardId),
  })
}

export function useUpdateList(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ listId, patch }: { listId: string; patch: ListPatch }) =>
      updateList(listId, patch),
    onSuccess: () => invalidateLists(client, boardId),
  })
}

export function useDeleteList(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (listId: string) => deleteList(listId),
    onSuccess: () => invalidateLists(client, boardId),
  })
}
