import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/useAuth'
import { queryKeys } from '@/lib/api/keys'
import { listMyTeams } from '@/lib/api/teams'

/**
 * The teams the signed-in user belongs to. The query is keyed by user id, so switching user in
 * development swaps the list rather than showing the previous user's cached teams.
 */
export function TeamNav() {
  const { status, user } = useAuth()
  const userId = user?.id
  const teams = useQuery({
    queryKey: queryKeys.myTeams(userId ?? ''),
    queryFn: ({ signal }) => listMyTeams(userId!, signal),
    enabled: status === 'signed-in' && Boolean(userId),
  })

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
          <li
            key={team.id}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-fg"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            <span className="min-w-0 flex-1 truncate">{team.name}</span>
            <span className="text-xs text-fg-muted capitalize">{role}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-labelledby="teams-heading" className="mt-6 px-2">
      <h2
        id="teams-heading"
        className="px-3 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase"
      >
        Teams
      </h2>
      {body}
    </section>
  )
}
