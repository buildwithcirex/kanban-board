import { SquareKanban } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { useMyTeams } from '@/features/teams/useTeams'
import { errorMessage } from '@/lib/api/errors'
import { BoardTile } from './BoardTile'
import { useAllBoards } from './useBoards'

/**
 * Every board you can open, grouped by team.
 *
 * Both queries are scoped by RLS, so there is no filtering here beyond the grouping — a board
 * from a team you left, or a private board you are not on, simply never arrives.
 */
export function BoardsPage() {
  const teams = useMyTeams()
  const boards = useAllBoards()

  const isPending = teams.isPending || boards.isPending
  const error = teams.error ?? boards.error

  const groups = (teams.data ?? [])
    .map(({ team }) => ({
      team,
      boards: (boards.data ?? []).filter((board) => board.team_id === team.id),
    }))
    .filter((group) => group.boards.length > 0)

  let body
  if (isPending) {
    body = (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner label="Loading boards" /> Loading boards…
      </p>
    )
  } else if (error) {
    body = (
      <p role="alert" className="text-sm text-danger">
        {errorMessage(error)}
      </p>
    )
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        icon={<SquareKanban />}
        title="No boards yet"
        description="Boards belong to teams. Open a team to make its first board."
      />
    )
  } else {
    body = (
      <div className="flex flex-col gap-6">
        {groups.map(({ team, boards: teamBoards }) => (
          <section key={team.id} aria-labelledby={`team-${team.id}-boards`}>
            <h3
              id={`team-${team.id}-boards`}
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              {team.name}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teamBoards.map((board) => (
                <li key={board.id}>
                  <BoardTile board={board} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <Page title="Boards" description="Boards from all the teams you belong to.">
      {body}
    </Page>
  )
}
