import { useState } from 'react'
import { NavLink } from 'react-router'
import { Plus } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/useAuth'
import { cn } from '@/lib/cn'
import { CreateTeamDialog } from './CreateTeamDialog'
import { useMyTeams } from './useTeams'

/**
 * The team switcher: the teams you belong to, each linking to its page. The query is keyed by
 * user id, so switching user in development swaps the list rather than showing the previous
 * user's cached teams.
 */
export function TeamNav() {
  const { status } = useAuth()
  const teams = useMyTeams()
  const [createOpen, setCreateOpen] = useState(false)

  let body
  if (status !== 'signed-in') {
    body = <p className="px-3 py-1 text-sm text-fg-muted">Sign in to see your teams</p>
  } else if (teams.isPending) {
    body = (
      <p className="flex items-center gap-2 px-3 py-1 text-sm text-fg-muted">
        <Spinner label="Loading teams" /> Loading…
      </p>
    )
  } else if (teams.isError) {
    body = (
      <p className="px-3 py-1 text-sm text-danger" role="alert">
        Couldn&apos;t load teams
      </p>
    )
  } else if (teams.data.length === 0) {
    body = <p className="px-3 py-1 text-sm text-fg-muted">No teams yet</p>
  } else {
    body = (
      <ul className="flex flex-col gap-0.5">
        {teams.data.map(({ team, role }) => (
          <li key={team.id}>
            <NavLink
              to={`/t/${team.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-fg hover:bg-surface-sunken hover:text-fg',
                )
              }
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="min-w-0 flex-1 truncate">{team.name}</span>
              <span className="text-xs text-fg-muted capitalize">{role}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-labelledby="teams-heading" className="mt-6 px-2">
      <div className="flex items-center justify-between pr-1 pl-3">
        <h2
          id="teams-heading"
          className="text-xs font-semibold tracking-wide text-fg-muted uppercase"
        >
          Your teams
        </h2>
        {status === 'signed-in' && (
          <IconButton
            size="sm"
            label="New team"
            icon={<Plus className="size-4" />}
            onClick={() => setCreateOpen(true)}
          />
        )}
      </div>
      {body}
      <CreateTeamDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  )
}
