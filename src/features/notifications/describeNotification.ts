import type { InboxItem, NotificationType } from '@/lib/api/notifications'

/** One sentence per kind. Unknown kinds still render, rather than vanishing. */
export function describeNotification(item: InboxItem, actorName: string): string {
  const title = typeof item.payload.title === 'string' ? item.payload.title : 'a card'
  const sentences: Record<NotificationType, string> = {
    card_assigned: `${actorName} assigned you ${title}`,
    card_unassigned: `${actorName} took you off ${title}`,
    mention: `${actorName} mentioned you on ${title}`,
    comment: `${actorName} commented on ${title}`,
    due_soon: `${title} is due soon`,
    overdue: `${title} is overdue`,
    added_to_team: `${actorName} added you to a team`,
    added_to_board: `${actorName} added you to a board`,
  }
  return sentences[item.type] ?? `${actorName} did something`
}
