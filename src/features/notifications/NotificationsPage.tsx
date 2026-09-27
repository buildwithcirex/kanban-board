import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bell, CheckCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { timeAgo } from '@/features/card-detail/commentText'
import { useMyTeams } from '@/features/teams/useTeams'
import { listTeamMembers } from '@/lib/api/teams'
import { errorMessage } from '@/lib/api/errors'
import { notificationHref, type InboxItem } from '@/lib/api/notifications'
import { cn } from '@/lib/cn'
import { useQueries } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/keys'
import { describeNotification } from './describeNotification'
import { useMarkRead, useNotifications, useUnreadCount } from './useNotifications'

function InboxRow({ item, name, color }: { item: InboxItem; name: string; color: string }) {
  const href = notificationHref(item)
  const unread = item.readAt === null

  const body = (
    <span className="flex w-full items-start gap-3">
      <Avatar name={name} color={color} size="sm" className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg">{describeNotification(item, name)}</span>
        <span className="block text-xs text-fg-muted">{timeAgo(item.createdAt)}</span>
      </span>
      {unread && (
        <>
          <span className="sr-only">Unread</span>
          <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
        </>
      )}
    </span>
  )

  const classes = cn(
    'press flex min-h-14 w-full items-center rounded-lg border px-3 py-2.5 text-left',
    unread ? 'border-accent/40 bg-accent-soft/40' : 'border-border bg-surface',
    href && 'hover:border-border-strong hover:bg-surface-sunken',
  )

  return (
    <li>
      {href ? (
        <Link to={href} className={classes}>
          {body}
        </Link>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </li>
  )
}

export function NotificationsPage() {
  const inbox = useNotifications()
  const unread = useUnreadCount()
  const markRead = useMarkRead()
  const teams = useMyTeams()

  // Names come from the teams the reader is in; an actor who has since left shows as "Someone"
  // rather than leaking anything about them.
  const memberQueries = useQueries({
    queries: (teams.data ?? []).map(({ team }) => ({
      queryKey: queryKeys.teamMembers(team.id),
      queryFn: () => listTeamMembers(team.id),
    })),
  })

  const people = useMemo(() => {
    const index = new Map<string, { name: string; color: string }>()
    for (const query of memberQueries) {
      for (const member of query.data ?? []) {
        index.set(member.userId, { name: member.name, color: member.color })
      }
    }
    return index
  }, [memberQueries])

  let body
  if (inbox.isPending) {
    body = (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner label="Loading notifications" /> Loading…
      </p>
    )
  } else if (inbox.isError) {
    body = (
      <p role="alert" className="text-sm text-danger">
        {errorMessage(inbox.error)}
      </p>
    )
  } else if (inbox.data.length === 0) {
    body = (
      <EmptyState
        icon={<Bell />}
        title="You're all caught up"
        description="Assignments, mentions and due-date reminders will appear here."
      />
    )
  } else {
    body = (
      <ul className="stagger flex flex-col gap-2">
        {inbox.data.map((item) => {
          const person = item.actorId ? people.get(item.actorId) : undefined
          return (
            <InboxRow
              key={item.id}
              item={item}
              name={person?.name ?? 'Someone'}
              color={person?.color ?? '#4b7bec'}
            />
          )
        })}
      </ul>
    )
  }

  return (
    <Page
      title="Notifications"
      description={unread.data ? `${unread.data} unread` : 'Assignments, mentions and reminders.'}
      actions={
        (unread.data ?? 0) > 0 ? (
          <Button
            size="sm"
            icon={<CheckCheck className="size-4" />}
            loading={markRead.isPending}
            onClick={() => markRead.mutate(undefined)}
          >
            Mark all read
          </Button>
        ) : undefined
      }
    >
      {body}
    </Page>
  )
}
