import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/api/errors'
import { CreateTeamDialog } from './CreateTeamDialog'
import { useMyTeams } from './useTeams'

/**
 * The teams overview.
 *
 * The sidebar switcher is hidden below `md`, so without this page teams would be unreachable on
 * a phone. It is also where "New team" lives for mobile.
 */
export function TeamsPage() {
  const teams = useMyTeams()
  const [createOpen, setCreateOpen] = useState(false)

  const newTeamButton = (
    <Button
      variant="primary"
      icon={<Plus className="size-4" />}
      onClick={() => setCreateOpen(true)}
    >
      New team
    </Button>
  )

  let body
  if (teams.isPending) {
    body = (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner label="Loading teams" /> Loading teams…
      </p>
    )
  } else if (teams.isError) {
    body = (
      <p role="alert" className="text-sm text-danger">
        {errorMessage(teams.error)}
      </p>
    )
  } else if (teams.data.length === 0) {
    body = (
      <EmptyState
        icon={<Users />}
        title="You're not in a team yet"
        description="Teams own boards. Create one, then add the people you work with."
        action={newTeamButton}
      />
    )
  } else {
    body = (
      <ul className="grid gap-3 sm:grid-cols-2">
        {teams.data.map(({ team, role }) => (
          <li key={team.id}>
            <Link
              to={`/t/${team.id}`}
              className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-sunken"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{team.name}</span>
                <span className="shrink-0 text-xs text-fg-muted capitalize">{role}</span>
              </span>
              {team.description && (
                <span className="line-clamp-2 text-sm text-fg-muted">{team.description}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Page
      title="Teams"
      description="Teams own boards. Everyone in a team can see its boards."
      actions={teams.data && teams.data.length > 0 ? newTeamButton : undefined}
    >
      {body}
      <CreateTeamDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Page>
  )
}
