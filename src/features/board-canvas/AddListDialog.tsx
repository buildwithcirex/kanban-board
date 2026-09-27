import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { listTitleSchema } from '@/features/boards/boardSchema'
import { firstIssue } from '@/features/teams/teamSchema'
import { errorMessage } from '@/lib/api/errors'

type AddListDialogProps = {
  open: boolean
  onClose: () => void
  onAdd: (title: string) => void
  pending: boolean
  error: unknown
}

/**
 * Adding a list.
 *
 * A dialog rather than a column pinned to the canvas: on a phone that column covered the board,
 * and it could not scroll with the lists because it sat outside the canvas.
 */
export function AddListDialog({ open, onClose, onAdd, pending, error }: AddListDialogProps) {
  const [title, setTitle] = useState('')
  const [issue, setIssue] = useState<string | null>(null)
  const fieldRef = useRef<HTMLInputElement>(null)
  const formId = 'add-list-form'

  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle('')
      setIssue(null)
    }
  }

  useEffect(() => {
    if (open) fieldRef.current?.focus()
  }, [open])

  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = firstIssue(listTitleSchema, title)
    setIssue(problem)
    if (problem) return
    onAdd(title)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a list"
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit" form={formId} loading={pending}>
            Add list
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <Input
          ref={fieldRef}
          label="List title"
          placeholder="e.g. In review"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={issue ?? (error ? errorMessage(error) : undefined)}
          maxLength={120}
        />
      </form>
    </Dialog>
  )
}
