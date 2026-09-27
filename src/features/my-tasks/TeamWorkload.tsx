import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/api/errors'
import type { TeamMember } from '@/lib/api/teams'
import { cn } from '@/lib/cn'
import { useTeamWorkload } from './useMyTasks'

/**
 * How much live work each teammate is carrying.
 *
 * A bar rather than a number alone: the useful question is "who is loaded compared to everyone
 * else", which a relative length answers at a glance. Overdue is called out separately because a
 * big number of on-time cards is not the same problem as one late one.
 */
export function TeamWorkload({ teamId, members }: { teamId: string; members: TeamMember[] }) {
  const workload = useTeamWorkload(teamId)
  const byUser = new Map((workload.data ?? []).map((entry) => [entry.userId, entry]))
  const busiest = Math.max(1, ...(workload.data ?? []).map((entry) => entry.total))

  return (
    <section
      aria-label="Workload"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5"
    >
      <h3 className="text-sm font-semibold">Workload</h3>

      {workload.isPending && (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner label="Loading workload" /> Loading…
        </p>
      )}

      {workload.isError && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(workload.error)}
        </p>
      )}

      {workload.data && members.length === 0 && (
        <p className="text-sm text-fg-muted">Nobody is in this team yet.</p>
      )}

      {workload.data && members.length > 0 && (
        <ul className="stagger flex flex-col gap-2.5">
          {members.map((member) => {
            const entry = byUser.get(member.userId)
            const total = entry?.total ?? 0
            const overdue = entry?.overdue ?? 0
            return (
              <li key={member.userId} className="flex items-center gap-3">
                <Avatar name={member.name} color={member.color} src={member.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-fg">{member.name}</span>
                    <span className="shrink-0 text-xs text-fg-muted tabular-nums">
                      {total === 0 ? 'nothing' : `${total} card${total === 1 ? '' : 's'}`}
                      {overdue > 0 && <span className="ml-1 text-danger">{overdue} late</span>}
                    </span>
                  </p>
                  {/* Decorative: the counts are already written out beside it, so announcing the
                      bar as well would just repeat them. */}
                  <div
                    aria-hidden
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-glide)]',
                        overdue > 0 ? 'bg-danger' : 'bg-accent',
                      )}
                      style={{ width: `${(total / busiest) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
