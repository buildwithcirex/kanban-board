import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Archive, Lock, Settings2, SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useSetPageTitle } from '@/app/pageTitle'
import { useMyRole } from '@/features/teams/useTeams'
import { errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { positionAtEnd } from '@/lib/ordering'
import { BoardSettingsDialog } from './BoardSettingsDialog'
import { AddListForm, ListColumn } from './ListColumn'
import { useBoard, useBoardBackground } from './useBoards'
import { useBoardLists, useCreateList } from './useLists'

export function BoardPage() {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>()
  const navigate = useNavigate()
  const board = useBoard(boardId)
  const myRole = useMyRole(teamId)
  const [showArchived, setShowArchived] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const lists = useBoardLists(boardId, showArchived)
  const createList = useCreateList(boardId ?? '')
  const { color, imageUrl } = useBoardBackground(board.data?.background ?? null)

  useSetPageTitle(board.data?.title)

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
        <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-end">
          <Button
            size="sm"
            onClick={() => setShowArchived((value) => !value)}
            aria-pressed={showArchived}
          >
            {showArchived ? 'Show active lists' : 'Show archived lists'}
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

      {lists.isError && (
        <p role="alert" className="mx-4 text-sm text-danger md:mx-6">
          {errorMessage(lists.error)}
        </p>
      )}

      {/* One list at a time snaps into view on a phone; they sit side by side from `md` up. */}
      <div className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:px-6">
        {lists.isPending && (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Spinner label="Loading lists" /> Loading lists…
          </div>
        )}

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
            {showArchived ? 'No archived lists.' : 'This board has no lists yet.'}
          </p>
        )}

        {editable && (
          <AddListForm
            pending={createList.isPending}
            onAdd={(title) =>
              createList.mutate({ title, position: positionAtEnd(lists.data ?? []) })
            }
          />
        )}
      </div>

      <BoardSettingsDialog
        board={board.data}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        canDelete={myRole === 'owner' || myRole === 'admin'}
      />
    </div>
  )
}
