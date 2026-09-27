import { useMemo, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Textarea } from '@/components/ui/Textarea'
import type { CardActivity, CardComment } from '@/lib/api/cardDetail'
import type { TeamMember } from '@/lib/api/teams'
import { Section } from './CardSections'
import { describeActivity, findMentions, timeAgo } from './commentText'

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
