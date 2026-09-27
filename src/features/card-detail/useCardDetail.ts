import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/keys'
import {
  addComment,
  assignCard,
  copyCard,
  createChecklist,
  createChecklistItem,
  createLabel,
  deleteAttachment,
  deleteChecklist,
  deleteChecklistItem,
  deleteComment,
  getCardDetail,
  listBoardLabels,
  setCardLabel,
  setChecklistItemDone,
  updateCardFields,
  uploadAttachment,
  type Attachment,
  type CardFields,
} from '@/lib/api/cardDetail'

/**
 * The card sheet's data.
 *
 * Every mutation refreshes both the card and the board behind it: a title, a label or an
 * assignee changes what the card front shows, so leaving the board stale would make the sheet
 * and the board disagree until the next navigation.
 */
function refresh(client: QueryClient, cardId: string, boardId: string) {
  void client.invalidateQueries({ queryKey: queryKeys.cardDetail(cardId) })
  void client.invalidateQueries({ queryKey: queryKeys.boardCards(boardId, false) })
  void client.invalidateQueries({ queryKey: queryKeys.boardCards(boardId, true) })
}

export function useCardDetail(cardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cardDetail(cardId ?? ''),
    queryFn: ({ signal }) => getCardDetail(cardId as string, signal),
    enabled: Boolean(cardId),
  })
}

export function useBoardLabels(boardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.boardLabels(boardId ?? ''),
    queryFn: ({ signal }) => listBoardLabels(boardId as string, signal),
    enabled: Boolean(boardId),
  })
}

/** One hook per card, so every call site already knows which card and board to refresh. */
export function useCardMutations(cardId: string, boardId: string) {
  const client = useQueryClient()
  const onSuccess = () => refresh(client, cardId, boardId)
  const labelsToo = () => {
    onSuccess()
    void client.invalidateQueries({ queryKey: queryKeys.boardLabels(boardId) })
  }

  return {
    updateFields: useMutation({
      mutationFn: (fields: CardFields) => updateCardFields(cardId, fields),
      onSuccess,
    }),
    assign: useMutation({
      mutationFn: ({ userId, assign }: { userId: string; assign: boolean }) =>
        assignCard(cardId, userId, assign),
      onSuccess,
    }),
    comment: useMutation({
      mutationFn: ({ body, mentions }: { body: string; mentions: string[] }) =>
        addComment(cardId, body, mentions),
      onSuccess,
    }),
    removeComment: useMutation({ mutationFn: deleteComment, onSuccess }),
    toggleLabel: useMutation({
      mutationFn: ({ labelId, on }: { labelId: string; on: boolean }) =>
        setCardLabel({ cardId, labelId, boardId, on }),
      onSuccess,
    }),
    addLabel: useMutation({
      mutationFn: (input: { name: string; color: string; position: string }) =>
        createLabel({ ...input, boardId }),
      onSuccess: labelsToo,
    }),
    addChecklist: useMutation({
      mutationFn: (input: { title: string; position: string }) =>
        createChecklist({ ...input, cardId }),
      onSuccess,
    }),
    removeChecklist: useMutation({ mutationFn: deleteChecklist, onSuccess }),
    addChecklistItem: useMutation({
      mutationFn: (input: { checklistId: string; text: string; position: string }) =>
        createChecklistItem(input),
      onSuccess,
    }),
    setItemDone: useMutation({
      mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
        setChecklistItemDone(itemId, done),
      onSuccess,
    }),
    removeChecklistItem: useMutation({ mutationFn: deleteChecklistItem, onSuccess }),
    upload: useMutation({ mutationFn: (file: File) => uploadAttachment(cardId, file), onSuccess }),
    removeAttachment: useMutation({
      mutationFn: (attachment: Attachment) => deleteAttachment(attachment),
      onSuccess,
    }),
    copy: useMutation({
      mutationFn: (input: { listId: string; position: string; title?: string }) =>
        copyCard({ ...input, cardId }),
      onSuccess,
    }),
  }
}
