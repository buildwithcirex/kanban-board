import { useState } from 'react'
import { Archive, ArchiveRestore, Copy, MoveRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { useDeleteCard } from '@/features/board-canvas/useCards'
import { cardTitleSchema } from '@/features/board-canvas/cardSchema'
import { firstIssue } from '@/features/teams/teamSchema'
import { signAttachmentUrl } from '@/lib/api/cardDetail'
import { errorMessage } from '@/lib/api/errors'
import type { List } from '@/lib/api/lists'
import type { TeamMember } from '@/lib/api/teams'
import { positionAtEnd } from '@/lib/ordering'
import {
  AssigneesSection,
  AttachmentsSection,
  ChecklistsSection,
  DatesSection,
  DescriptionSection,
  LabelsSection,
  Section,
} from './CardSections'
import { CommentsSection } from './CommentsSection'
import { useBoardLabels, useCardDetail, useCardMutations } from './useCardDetail'

type CardDetailSheetProps = {
  cardId: string | null
  boardId: string
  lists: List[]
  members: TeamMember[]
  myUserId: string | null
  /** False when the board is archived: the sheet still opens, but read-only. */
  editable: boolean
  onClose: () => void
  onRequestMove: (cardId: string) => void
}

/**
 * The card, opened over the board.
 *
 * Full screen on a phone and a centred panel from `sm` up (see `Sheet`). Everything inside is a
 * plain stacked section: on a 360px screen there is no room for the two-column layout a desktop
 * Trello card uses, and a single column reads the same at every width.
 */
export function CardDetailSheet({
  cardId,
  boardId,
  lists,
  members,
  myUserId,
  editable,
  onClose,
  onRequestMove,
}: CardDetailSheetProps) {
  const detail = useCardDetail(cardId ?? undefined)
  const labels = useBoardLabels(boardId)
  const mutations = useCardMutations(cardId ?? '', boardId)
  const deleteCard = useDeleteCard(boardId)

  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const card = detail.data?.card
  const cardArchived = card?.archived ?? false
  // An archived card is read-only until it is restored, the same rule as an archived board.
  const canEdit = editable && !cardArchived

  // Resetting the draft when a different card opens is a render-time adjustment, not a side
  // effect: doing it in an effect would paint the previous card's title for one frame.
  const [lastCardId, setLastCardId] = useState<string | null>(null)
  if (card && card.id !== lastCardId) {
    setLastCardId(card.id)
    setTitle(card.title)
    setTitleError(null)
  }

  function saveTitle() {
    const issue = firstIssue(cardTitleSchema, title)
    setTitleError(issue)
    if (issue || !card || title.trim() === card.title) return
    mutations.updateFields.mutate({ title })
  }

  const list = lists.find((item) => item.id === card?.list_id)

  return (
    <>
      <Sheet
        open={cardId !== null}
        onClose={onClose}
        title={
          detail.data ? (
            <Input
              label="Card title"
              hideLabel
              value={title}
              disabled={!canEdit}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              error={titleError ?? undefined}
              maxLength={512}
              className="border-transparent bg-transparent px-0 text-base font-semibold"
            />
          ) : (
            'Card'
          )
        }
        subtitle={
          list ? (
            <>
              in <span className="font-medium text-fg">{list.title}</span>
              {cardArchived && ' · archived'}
            </>
          ) : undefined
        }
        footer={
          detail.data && (
            <>
              <Button
                size="sm"
                icon={<MoveRight className="size-4" />}
                disabled={!canEdit}
                onClick={() => {
                  if (cardId) onRequestMove(cardId)
                }}
              >
                Move
              </Button>
              <Button
                size="sm"
                icon={<Copy className="size-4" />}
                disabled={!canEdit}
                loading={mutations.copy.isPending}
                onClick={() => {
                  if (!card) return
                  mutations.copy.mutate(
                    {
                      listId: card.list_id,
                      position: positionAtEnd([]),
                      title: `${card.title} (copy)`,
                    },
                    { onSuccess: onClose },
                  )
                }}
              >
                Copy
              </Button>
              <Button
                size="sm"
                icon={
                  cardArchived ? (
                    <ArchiveRestore className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )
                }
                disabled={!editable}
                loading={mutations.updateFields.isPending}
                onClick={() =>
                  mutations.updateFields.mutate(
                    { archived: !cardArchived },
                    { onSuccess: cardArchived ? undefined : onClose },
                  )
                }
              >
                {cardArchived ? 'Restore' : 'Archive'}
              </Button>
              {cardArchived && editable && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )}
            </>
          )
        }
      >
        {detail.isPending && (
          <div className="flex justify-center py-12">
            <Spinner label="Loading the card" className="size-6 text-fg-muted" />
          </div>
        )}

        {detail.isError && (
          <p role="alert" className="py-8 text-center text-sm text-danger">
            {errorMessage(detail.error)}
          </p>
        )}

        {detail.data && (
          <div className="flex flex-col">
            {cardArchived && (
              <output className="mb-3 block rounded-md bg-warning/15 px-3 py-2 text-sm text-fg">
                This card is archived. Restore it to make changes.
              </output>
            )}

            <DescriptionSection
              value={detail.data.card.description}
              editable={canEdit}
              pending={mutations.updateFields.isPending}
              onSave={(description) => mutations.updateFields.mutate({ description })}
            />

            <AssigneesSection
              assigneeIds={detail.data.assigneeIds}
              members={members}
              editable={canEdit}
              myUserId={myUserId}
              onToggle={(userId, assign) => mutations.assign.mutate({ userId, assign })}
            />

            <LabelsSection
              labels={labels.data ?? []}
              labelIds={detail.data.labelIds}
              editable={canEdit}
              pending={mutations.addLabel.isPending}
              onToggle={(labelId, on) => mutations.toggleLabel.mutate({ labelId, on })}
              onCreate={(name, color, position) =>
                mutations.addLabel.mutate({ name, color, position })
              }
            />

            <DatesSection
              detail={detail.data}
              editable={canEdit}
              onChange={(fields) => mutations.updateFields.mutate(fields)}
            />

            <ChecklistsSection
              detail={detail.data}
              editable={canEdit}
              onAddChecklist={(checklistTitle, position) =>
                mutations.addChecklist.mutate({ title: checklistTitle, position })
              }
              onRemoveChecklist={(checklistId) => mutations.removeChecklist.mutate(checklistId)}
              onAddItem={(checklistId, text, position) =>
                mutations.addChecklistItem.mutate({ checklistId, text, position })
              }
              onToggleItem={(itemId, done) => mutations.setItemDone.mutate({ itemId, done })}
              onRemoveItem={(itemId) => mutations.removeChecklistItem.mutate(itemId)}
            />

            <AttachmentsSection
              attachments={detail.data.attachments}
              editable={canEdit}
              uploading={mutations.upload.isPending}
              error={attachmentError}
              onUpload={(file) => {
                setAttachmentError(null)
                mutations.upload.mutate(file, {
                  onError: (error) => setAttachmentError(errorMessage(error)),
                })
              }}
              onOpen={(attachment) => {
                // The bucket is private, so every open needs a fresh signed URL.
                void signAttachmentUrl(attachment.storage_path)
                  .then((url) => window.open(url, '_blank', 'noopener,noreferrer'))
                  .catch((error: unknown) => setAttachmentError(errorMessage(error)))
              }}
              onRemove={(attachment) => mutations.removeAttachment.mutate(attachment)}
            />

            <CommentsSection
              comments={detail.data.comments}
              activity={detail.data.activity}
              members={members}
              myUserId={myUserId}
              editable={canEdit}
              pending={mutations.comment.isPending}
              onComment={(body, mentions) => mutations.comment.mutate({ body, mentions })}
              onDelete={(commentId) => mutations.removeComment.mutate(commentId)}
            />

            {(mutations.updateFields.isError ||
              mutations.assign.isError ||
              mutations.comment.isError ||
              mutations.toggleLabel.isError) && (
              <Section title="Something went wrong">
                <p role="alert" className="text-sm text-danger">
                  {errorMessage(
                    mutations.updateFields.error ??
                      mutations.assign.error ??
                      mutations.comment.error ??
                      mutations.toggleLabel.error,
                  )}
                </p>
              </Section>
            )}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${card?.title ?? 'this card'}?`}
        description="Its checklists, comments and files go with it."
        warning="This cannot be undone."
        confirmLabel="Delete card"
        loading={deleteCard.isPending}
        error={deleteCard.isError ? errorMessage(deleteCard.error) : null}
        onConfirm={() => {
          if (!cardId) return
          deleteCard.mutate(cardId, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
            },
          })
        }}
        onClose={() => {
          setConfirmDelete(false)
          deleteCard.reset()
        }}
      />
    </>
  )
}
