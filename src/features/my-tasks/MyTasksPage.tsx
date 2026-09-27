import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, ListTodo } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { dueDateLabel, dueDateTone } from '@/features/board-canvas/dueDate'
import { useMyTeams } from '@/features/teams/useTeams'
import { errorMessage } from '@/lib/api/errors'
import type { MyTask } from '@/lib/api/myTasks'
import { cn } from '@/lib/cn'
import { groupTasks } from './grouping'
import { useMyTasks } from './useMyTasks'

const priorityTone: Record<string, string> = {
  urgent: 'bg-danger/15 text-danger',
  high: 'bg-warning/20 text-warning',
  medium: 'bg-surface-sunken text-fg-muted',
  low: 'bg-surface-sunken text-fg-muted',
}

function TaskRow({ task }: { task: MyTask }) {
  const due = dueDateLabel(task.dueDate, task.dueComplete)

  return (
    <li>
      <Link
        to={`/t/${task.teamId}/b/${task.boardId}/c/${task.cardId}`}
        className="press flex min-h-14 flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2.5 hover:border-border-strong hover:bg-surface-sunken"
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-sm font-medium text-fg">{task.title}</span>
          {task.priority !== 'none' && (
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium capitalize',
                priorityTone[task.priority] ?? 'bg-surface-sunken text-fg-muted',
              )}
            >
              {task.priority}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          <span className="truncate">
            {task.boardTitle} · {task.listTitle}
          </span>
          {due && (
            <span
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-0.5',
                dueDateTone(task.dueDate, task.dueComplete),
              )}
            >
              <CalendarClock className="size-3" aria-hidden />
              {due}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

/**
 * Everything assigned to the signed-in user, across every team, grouped by when it is due.
 *
 * One flat list rather than a board per team: the question this page answers is "what should I do
 * next", which cuts across boards. The team filter is there for when it does not.
 */
export function MyTasksPage() {
  const tasks = useMyTasks()
  const teams = useMyTeams()
  const [teamId, setTeamId] = useState('')

  const groups = useMemo(() => {
    const visible = teamId
      ? (tasks.data ?? []).filter((task) => task.teamId === teamId)
      : (tasks.data ?? [])
    return groupTasks(visible)
  }, [tasks.data, teamId])

  const total = groups.reduce((count, group) => count + group.tasks.length, 0)

  let body
  if (tasks.isPending) {
    body = (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner label="Loading your tasks" /> Loading your tasks…
      </p>
    )
  } else if (tasks.isError) {
    body = (
      <p role="alert" className="text-sm text-danger">
        {errorMessage(tasks.error)}
      </p>
    )
  } else if (total === 0) {
    body = (
      <EmptyState
        icon={<ListTodo />}
        title={teamId ? 'Nothing assigned to you here' : 'Nothing assigned to you'}
        description="When a teammate assigns you a card, it appears here grouped by due date."
      />
    )
  } else {
    body = (
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.bucket} aria-labelledby={`bucket-${group.bucket}`}>
            <h3
              id={`bucket-${group.bucket}`}
              className="mb-2 flex items-baseline gap-2 text-xs font-semibold tracking-wide text-fg-muted uppercase"
            >
              {group.label}
              <span className="text-fg-muted tabular-nums">{group.tasks.length}</span>
            </h3>
            <ul className="stagger flex flex-col gap-2">
              {group.tasks.map((task) => (
                <TaskRow key={task.cardId} task={task} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <Page
      title="My Tasks"
      description="Cards assigned to you across every team."
      actions={
        (teams.data ?? []).length > 1 ? (
          <div className="w-44">
            <Select
              label="Team"
              hideLabel
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">Every team</option>
              {(teams.data ?? []).map(({ team }) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
        ) : undefined
      }
    >
      {body}
    </Page>
  )
}
