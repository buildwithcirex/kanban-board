import { useState } from 'react'
import { Plus, SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/api/errors'
import { BoardTile } from './BoardTile'
import { CreateBoardDialog } from './CreateBoardDialog'
import { useTeamBoards } from './useBoards'

type TeamBoardsProps = {
  teamId: string
  /** False for someone who is not in the team; they should not be offered a create button. */
  canCreate: boolean
}

/** The boards section of a team page, with its archive behind a toggle. */
export function TeamBoards({ teamId, canCreate }: TeamBoardsProps) {
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const boards = useTeamBoards(teamId, showArchived)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Boards</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            aria-pressed={showArchived}
            onClick={() => setShowArchived((value) => !value)}
          >
            {showArchived ? 'Show active' : 'Show archived'}
          </Button>
          {canCreate && !showArchived && (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setCreateOpen(true)}
            >
              New board
            </Button>
          )}
        </div>
      </div>

      {boards.isPending && (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner label="Loading boards" /> Loading boards…
        </p>
      )}

      {boards.isError && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(boards.error)}
        </p>
      )}

      {boards.data && boards.data.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <SquareKanban className="size-4" aria-hidden />
          {showArchived ? 'Nothing archived.' : 'No boards yet.'}
        </p>
      )}

      {boards.data && boards.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.data.map((board) => (
            <li key={board.id}>
              <BoardTile board={board} />
            </li>
          ))}
        </ul>
      )}

      <CreateBoardDialog teamId={teamId} open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  )
}
