import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Archive, Lock, Settings2, SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useSetPageTitle } from '@/app/pageTitle'
import { AddCardDialog } from '@/features/board-canvas/AddCardDialog'
import { BoardCanvas, type BoardFilter } from '@/features/board-canvas/BoardCanvas'
import { MoveCardDialog } from '@/features/board-canvas/MoveCardDialog'
import { useBoardCards, useCreateCard, useMoveCard } from '@/features/board-canvas/useCards'
import { useAuth } from '@/features/auth/useAuth'
import { useMyRole, useTeamMembers } from '@/features/teams/useTeams'
import { errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { positionAtEnd, positionAtIndex, sortByPosition } from '@/lib/ordering'
import { BoardSettingsDialog } from './BoardSettingsDialog'
import { AddListForm, ListColumn } from './ListColumn'
import { useBoard, useBoardBackground } from './useBoards'
import { useBoardLists, useCreateList, useUpdateList } from './useLists'

export function BoardPage() {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const board = useBoard(boardId)
  const myRole = useMyRole(teamId)
  const members = useTeamMembers(teamId)
  const [showArchived, setShowArchived] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filter, setFilter] = useState<BoardFilter>({ mineOnly: false, memberId: null })
  const [addingToList, setAddingToList] = useState<string | null>(null)
  const [movingCard, setMovingCard] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const lists = useBoardLists(boardId, showArchived)
  const cards = useBoardCards(boardId)
  const createList = useCreateList(boardId ?? '')
  const updateList = useUpdateList(boardId ?? '')
  const createCard = useCreateCard(boardId ?? '')
  const moveCard = useMoveCard(boardId ?? '')
  const { color, imageUrl } = useBoardBackground(board.data?.background ?? null)

  useSetPageTitle(board.data?.title)

  const listById = useMemo(
    () => new Map((lists.data ?? []).map((list) => [list.id, list])),
    [lists.data],
  )

  /** Moves the card and says where it ended up, for the board's live region. */
  const handleMoveCard = useCallback(
    (move: { cardId: string; listId: string; position: string }) => {
      moveCard.mutate(move)

      const card = (cards.data ?? []).find((item) => item.id === move.cardId)
      const target = listById.get(move.listId)
      if (!card || !target) return

      const others = (cards.data ?? [])
        .filter((item) => item.list_id === move.listId && item.id !== move.cardId)
        .map((item) => ({ id: item.id, position: item.position }))
      const index = sortByPosition([...others, { id: move.cardId, position: move.position }])
        .map((item) => item.id)
        .indexOf(move.cardId)

      setAnnouncement(
        `${card.title} moved to ${target.title}, position ${index + 1} of ${others.length + 1}`,
      )
    },
    [cards.data, listById, moveCard],
  )

  if (board.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner label="Loading board" className="size-6 text-fg-muted" />
      </div>
    )
  }

  // A board you cannot see and one that does not exist look the same on purpose.
  if (board.isError || !board.data) {
    return (
      <EmptyState
        icon={<SquareKanban />}
        title="Board not found"
        description="It may have been deleted, or it's private and you're not on it."
        action={
          <Button variant="primary" onClick={() => void navigate('/')}>
            Go to boards
          </Button>
        }
      />
    )
  }

  // Only an archived *board* is read-only. The archived-lists view must stay interactive, or
  // there would be no way to restore anything from it.
  const editable = !board.data.archived
  const onDark = Boolean(color || imageUrl)
  const movingCardData = (cards.data ?? []).find((card) => card.id === movingCard) ?? null

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{
        backgroundColor: color ?? undefined,
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <header
        className={cn(
          'flex flex-wrap items-center gap-2 px-4 py-3 md:px-6',
          onDark && 'bg-black/30 backdrop-blur-sm',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            className={cn(
              'flex items-center gap-2 truncate text-lg font-semibold',
              onDark ? 'text-white' : 'text-fg',
            )}
          >
            {board.data.title}
            {board.data.visibility === 'private' && (
              <Lock className="size-4 shrink-0" aria-label="Private board" />
            )}
            {board.data.archived && (
              <span className="flex items-center gap-1 rounded bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                <Archive className="size-3" aria-hidden />
                Archived
              </span>
            )}
          </h2>
          <Link
            to={`/t/${board.data.team_id}`}
            className={cn(
              'truncate text-xs hover:underline',
              onDark ? 'text-white/75' : 'text-fg-muted',
            )}
          >
            Back to the team
          </Link>
        </div>

        {/* Full width below `sm` so the buttons wrap under the title instead of crushing it. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:justify-end">
          {!showArchived && (
            <>
              <Button
                size="sm"
                aria-pressed={filter.mineOnly}
                className={cn(filter.mineOnly && 'border-accent text-accent')}
                onClick={() =>
                  setFilter((current) => ({ ...current, mineOnly: !current.mineOnly }))
                }
              >
                My cards only
              </Button>
              <Select
                label="Highlight a teammate's cards"
                hideLabel
                value={filter.memberId ?? ''}
                className="h-8 w-40 text-xs"
                onChange={(event) =>
                  setFilter((current) => ({ ...current, memberId: event.target.value || null }))
                }
              >
                <option value="">Everyone</option>
                {(members.data ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </>
          )}
          <Button
            size="sm"
            onClick={() => setShowArchived((value) => !value)}
            aria-pressed={showArchived}
          >
            {showArchived ? 'Show the board' : 'Archived lists'}
          </Button>
          <Button
            size="sm"
            icon={<Settings2 className="size-4" />}
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
        </div>
      </header>

      {board.data.archived && (
        <p
          role="status"
          className="mx-4 mb-2 rounded-md bg-warning/15 px-3 py-2 text-sm text-fg md:mx-6"
        >
          This board is archived, so nothing on it can be changed. Restore it from Settings.
        </p>
      )}

      {(lists.isError || cards.isError || moveCard.isError) && (
        <p role="alert" className="mx-4 mb-2 text-sm text-danger md:mx-6">
          {errorMessage(lists.error ?? cards.error ?? moveCard.error)}
        </p>
      )}

      {showArchived ? (
        <div className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:px-6">
          {lists.data?.map((list) => (
            <ListColumn key={list.id} list={list} boardId={board.data.id} editable={editable} />
          ))}
          {lists.data && lists.data.length === 0 && (
            <p
              className={cn(
                'self-start rounded-md px-2 py-6 text-sm',
                onDark ? 'text-white/80' : 'text-fg-muted',
              )}
            >
              No archived lists.
            </p>
          )}
        </div>
      ) : (
        <div className="relative flex-1">
          {(lists.isPending || cards.isPending) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner label="Loading the board" className="size-6 text-fg-muted" />
            </div>
          )}

          {lists.data && cards.data && (
            <BoardCanvas
              lists={lists.data}
              cards={cards.data}
              members={members.data ?? []}
              myUserId={user?.id ?? null}
              editable={editable}
              filter={filter}
              announcement={announcement}
              onMoveCard={handleMoveCard}
              onReorderList={(listId, position) =>
                updateList.mutate({ listId, patch: { position } })
              }
              onRenameList={(listId, title) => updateList.mutate({ listId, patch: { title } })}
              onArchiveList={(listId, archived) =>
                updateList.mutate({ listId, patch: { archived } })
              }
              onAddCard={setAddingToList}
              onOpenCard={() => setAnnouncement('Card details arrive in the next phase')}
              onRequestMove={setMovingCard}
            />
          )}

          {editable && lists.data && (
            <div className="pointer-events-none absolute top-2 right-2 w-56">
              <div className="pointer-events-auto">
                <AddListForm
                  pending={createList.isPending}
                  onAdd={(title) =>
                    createList.mutate({ title, position: positionAtEnd(lists.data) })
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}

      <AddCardDialog
        list={addingToList ? (listById.get(addingToList) ?? null) : null}
        pending={createCard.isPending}
        error={createCard.isError ? createCard.error : null}
        onClose={() => {
          setAddingToList(null)
          createCard.reset()
        }}
        onAdd={(title) => {
          if (!addingToList) return
          const inList = (cards.data ?? [])
            .filter((card) => card.list_id === addingToList)
            .map((card) => ({ id: card.id, position: card.position }))
          createCard.mutate(
            { listId: addingToList, title, position: positionAtEnd(inList) },
            {
              onSuccess: () => {
                setAddingToList(null)
                setAnnouncement(`${title.trim()} added`)
              },
            },
          )
        }}
      />

      <MoveCardDialog
        card={movingCardData}
        lists={lists.data ?? []}
        cards={cards.data ?? []}
        pending={moveCard.isPending}
        onClose={() => setMovingCard(null)}
        onMove={(listId, index) => {
          if (!movingCardData) return
          const others = (cards.data ?? [])
            .filter((card) => card.list_id === listId && card.id !== movingCardData.id)
            .map((card) => ({ id: card.id, position: card.position }))
          handleMoveCard({
            cardId: movingCardData.id,
            listId,
            position: positionAtIndex(others, index),
          })
          setMovingCard(null)
        }}
      />

      <BoardSettingsDialog
        board={board.data}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        canDelete={myRole === 'owner' || myRole === 'admin'}
      />
    </div>
  )
}
