import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { firstIssue } from '@/features/teams/teamSchema'
import { errorMessage } from '@/lib/api/errors'
import type { List } from '@/lib/api/lists'
import { cardTitleSchema } from './cardSchema'

type AddCardDialogProps = {
  list: List | null
  onClose: () => void
  onAdd: (title: string) => void
  pending: boolean
  error: unknown
}

/**
 * Adding a card.
 *
 * A dialog rather than Trello's inline composer: a composer would have to live inside a canvas
 * node, where it competes with the canvas for the pointer and cannot grow without disturbing the
 * layout. The rest of a card is filled in on the card itself, next phase.
 */
export function AddCardDialog({ list, onClose, onAdd, pending, error }: AddCardDialogProps) {
  const [title, setTitle] = useState('')
  const [issue, setIssue] = useState<string | null>(null)
  const formId = 'add-card-form'

  // Clearing the draft as a new list opens is a render-time adjustment; an effect would show the
  // previous list's text for a frame.
  const [lastListId, setLastListId] = useState<string | null>(null)
  if (list && list.id !== lastListId) {
    setLastListId(list.id)
    setTitle('')
    setIssue(null)
  }

  // Focus is a DOM effect, not state, so it belongs here rather than on an autoFocus attribute
  // that would also steal focus when the dialog is merely re-rendered.
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (list) fieldRef.current?.focus()
  }, [list])

  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = firstIssue(cardTitleSchema, title)
    setIssue(problem)
    if (problem) return
    onAdd(title)
  }

  return (
    <Dialog
      open={list !== null}
      onClose={onClose}
      title="Add a card"
      description={list ? `To ${list.title}` : undefined}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit" form={formId} loading={pending}>
            Add card
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <Textarea
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            // Enter submits; Shift+Enter is a new line, as everywhere else.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit(event)
            }
          }}
          error={issue ?? (error ? errorMessage(error) : undefined)}
          maxLength={512}
          ref={fieldRef}
        />
      </form>
    </Dialog>
  )
}
