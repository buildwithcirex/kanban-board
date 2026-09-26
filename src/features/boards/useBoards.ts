import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import {
  addBoardMember,
  createBoard,
  deleteBoard,
  getBoard,
  listAllBoards,
  listBoardMembers,
  listTeamBoards,
  parseBackground,
  removeBoardMember,
  setBoardVisibility,
  signBackgroundUrl,
  updateBoard,
  type BoardPatch,
  type BoardVisibility,
  type NewBoard,
} from '@/lib/api/boards'
import { queryKeys } from '@/lib/api/keys'

/**
 * Queries and mutations for boards.
 *
 * Board lists are keyed by `archived`, so archiving a board has to invalidate both views — the
 * row moves from one query to the other rather than changing within one.
 */

function invalidateBoards(client: QueryClient, teamId: string | undefined, boardId?: string) {
  if (teamId) {
    void client.invalidateQueries({ queryKey: queryKeys.teamBoards(teamId, false) })
    void client.invalidateQueries({ queryKey: queryKeys.teamBoards(teamId, true) })
  }
  void client.invalidateQueries({ queryKey: queryKeys.allBoards })
  if (boardId) void client.invalidateQueries({ queryKey: queryKeys.board(boardId) })
}

export function useTeamBoards(teamId: string | undefined, archived = false) {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.teamBoards(teamId ?? '', archived),
    queryFn: ({ signal }) => listTeamBoards(teamId as string, { archived }, signal),
    enabled: status === 'signed-in' && Boolean(teamId),
  })
}

export function useAllBoards() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.allBoards,
    queryFn: ({ signal }) => listAllBoards(signal),
    enabled: status === 'signed-in',
  })
}

export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.board(boardId ?? ''),
    queryFn: ({ signal }) => getBoard(boardId as string, signal),
    enabled: Boolean(boardId),
  })
}

export function useCreateBoard(teamId: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<NewBoard, 'teamId'>) =>
      createBoard({ ...input, teamId: teamId as string }),
    onSuccess: (board) => invalidateBoards(client, board.team_id, board.id),
  })
}

export function useUpdateBoard(boardId: string, teamId: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: BoardPatch) => updateBoard(boardId, patch),
    onSuccess: () => invalidateBoards(client, teamId, boardId),
  })
}

export function useSetBoardVisibility(boardId: string, teamId: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (visibility: BoardVisibility) => setBoardVisibility(boardId, visibility),
    onSuccess: () => {
      invalidateBoards(client, teamId, boardId)
      void client.invalidateQueries({ queryKey: queryKeys.boardMembers(boardId) })
    },
  })
}

export function useDeleteBoard(teamId: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: (_result, boardId) => {
      client.removeQueries({ queryKey: queryKeys.board(boardId) })
      invalidateBoards(client, teamId)
    },
  })
}

export function useBoardMembers(boardId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.boardMembers(boardId ?? ''),
    queryFn: ({ signal }) => listBoardMembers(boardId as string, signal),
    enabled: enabled && Boolean(boardId),
  })
}

export function useAddBoardMember(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => addBoardMember(boardId, userId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.boardMembers(boardId) }),
  })
}

export function useRemoveBoardMember(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeBoardMember(boardId, userId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.boardMembers(boardId) }),
  })
}

/**
 * Resolves a board's background to something renderable.
 *
 * Image backgrounds live in a private bucket, so each one needs a signed URL. The signature is
 * good for an hour; the query is refreshed well before that so a long-open board does not end up
 * showing a broken image.
 */
export function useBoardBackground(background: string | null) {
  const parsed = parseBackground(background)
  const path = parsed.kind === 'image' ? parsed.path : null

  const signed = useQuery({
    queryKey: queryKeys.boardBackground(path ?? ''),
    queryFn: () => signBackgroundUrl(path as string),
    enabled: Boolean(path),
    staleTime: 45 * 60 * 1000,
    refetchInterval: 45 * 60 * 1000,
    retry: false,
  })

  if (parsed.kind === 'color') return { color: parsed.color, imageUrl: null }
  if (parsed.kind === 'image') return { color: null, imageUrl: signed.data ?? null }
  return { color: null, imageUrl: null }
}
