import type { CardActivity } from '@/lib/api/cardDetail'
import type { TeamMember } from '@/lib/api/teams'

/**
 * Finds `@name` mentions in a comment and maps them to team members.
 *
 * Matching is done here so the body stays plain text — storing markup would mean escaping it
 * again on the way out. The server re-checks every id against the board's team anyway, so a
 * wrong guess here can only fail to notify, never notify the wrong person.
 */
export function findMentions(body: string, members: TeamMember[]): string[] {
  const found = new Set<string>()
  for (const member of members) {
    // A name can contain spaces, so match the whole name rather than one word.
    const handle = `@${member.name}`.toLowerCase()
    if (body.toLowerCase().includes(handle)) found.add(member.userId)

    const firstName = member.name.split(/\s+/)[0]
    if (firstName && firstName.length > 1) {
      const pattern = new RegExp(
        `@${firstName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`,
        'i',
      )
      if (pattern.test(body)) found.add(member.userId)
    }
  }
  return [...found]
}

/** Short, relative time: comments are read in the context of "when", not "exactly when". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const delta = now.getTime() - new Date(iso).getTime()
  if (Number.isNaN(delta)) return ''
  const minutes = Math.round(delta / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Turns an activity row into a sentence. Unknown types fall back to the raw type. */
export function describeActivity(entry: CardActivity, names: Map<string, string>): string {
  const who = entry.actorId ? (names.get(entry.actorId) ?? 'Someone') : 'Someone'
  const target = (key: string) => {
    const id = entry.payload[key]
    return typeof id === 'string' ? (names.get(id) ?? 'someone') : 'someone'
  }
  switch (entry.type) {
    case 'card.created':
      return `${who} added this card`
    case 'card.moved':
      return `${who} moved this card to another list`
    case 'card.copied':
      return `${who} copied this card`
    case 'card.assigned':
      return `${who} assigned ${target('user_id')}`
    case 'card.unassigned':
      return `${who} unassigned ${target('user_id')}`
    case 'card.commented':
      return `${who} commented`
    default:
      return `${who} · ${entry.type}`
  }
}
