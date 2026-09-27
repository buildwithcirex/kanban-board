import { useMemo, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Textarea } from '@/components/ui/Textarea'
import type { CardActivity, CardComment } from '@/lib/api/cardDetail'
import type { TeamMember } from '@/lib/api/teams'
import { Section } from './CardSections'

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

type CommentsSectionProps = {
  comments: CardComment[]
  activity: CardActivity[]
  members: TeamMember[]
  myUserId: string | null
  editable: boolean
  pending: boolean
  onComment: (body: string, mentions: string[]) => void
  onDelete: (commentId: string) => void
}

export function CommentsSection({
  comments,
  activity,
  members,
  myUserId,
  editable,
  pending,
  onComment,
  onDelete,
}: CommentsSectionProps) {
  const [body, setBody] = useState('')
  const memberIndex = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  )
  const names = useMemo(
    () => new Map(members.map((member) => [member.userId, member.name])),
    [members],
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    const text = body.trim()
    if (!text) return
    onComment(text, findMentions(text, members))
    setBody('')
  }

  return (
    <>
      <Section title="Comments">
        {editable && (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <Textarea
              label="Add a comment"
              hideLabel
              placeholder="Write a comment… use @name to mention someone"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={10000}
              className="min-h-20"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="primary"
                type="submit"
                loading={pending}
                disabled={!body.trim()}
              >
                Comment
              </Button>
            </div>
          </form>
        )}

        {comments.length === 0 && <p className="text-sm text-fg-muted">No comments yet.</p>}

        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const author = comment.authorId ? memberIndex.get(comment.authorId) : undefined
            return (
              <li key={comment.id} className="flex gap-2">
                <Avatar
                  name={author?.name ?? '?'}
                  color={author?.color}
                  src={author?.avatarUrl}
                  size="sm"
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-fg-muted">
                    <span className="font-medium text-fg">{author?.name ?? 'Former member'}</span>
                    {timeAgo(comment.createdAt)}
                  </p>
                  <p className="text-sm break-words whitespace-pre-wrap text-fg">{comment.body}</p>
                </div>
                {comment.authorId === myUserId && (
                  <IconButton
                    size="sm"
                    label="Delete this comment"
                    icon={<Trash2 className="size-4" />}
                    className="hover:bg-danger-soft hover:text-danger"
                    onClick={() => onDelete(comment.id)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="Activity">
        {activity.length === 0 ? (
          <p className="text-sm text-fg-muted">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-2 text-xs text-fg-muted">
                <span className="text-fg">{describeActivity(entry, names)}</span>
                <span>{timeAgo(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
