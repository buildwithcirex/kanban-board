import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { firstIssue } from '@/features/teams/teamSchema'
import { errorMessage } from '@/lib/api/errors'
import type { List } from '@/lib/api/lists'
import { listTitleSchema } from './boardSchema'
import { useDeleteList, useUpdateList } from './useLists'

type ListColumnProps = {
  list: List
  boardId: string
  /** False for an archived board, where everything on it is read-only. */
  editable: boolean
}

/**
 * One column of the board.
 *
 * Renaming is inline rather than behind a menu: it is the only edit a list has, and a dialog for
 * a single text field is a lot of ceremony. Cards arrive in Phase 4.
 */
export function ListColumn({ list, boardId, editable }: ListColumnProps) {
  const updateList = useUpdateList(boardId)
  const deleteList = useDeleteList(boardId)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(list.title)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function save(event?: FormEvent) {
    event?.preventDefault()
    const issue = firstIssue(listTitleSchema, title)
    setError(issue)
    if (issue) return
    if (title.trim() === list.title) {
      setEditing(false)
      return
    }
    updateList.mutate({ listId: list.id, patch: { title } }, { onSuccess: () => setEditing(false) })
  }

  function cancel() {
    setTitle(list.title)
    setError(null)
    setEditing(false)
  }

  // Clicking away keeps the edit, the way Trello does — losing what you typed because you
  // clicked the wrong pixel is worse than an accidental rename, which is one click to undo.
  // An emptied title has nothing to save, so it reverts instead.
  function handleBlur() {
    if (title.trim() === '') cancel()
    else save()
  }

  return (
    <section
      aria-label={list.title}
      className="flex w-72 shrink-0 snap-start flex-col gap-2 rounded-lg bg-surface/95 p-2 backdrop-blur-sm"
    >
      <header className="flex items-start gap-1">
        {editing ? (
          <form onSubmit={save} className="flex-1" noValidate>
            <Input
              ref={inputRef}
              label={`Rename ${list.title}`}
              hideLabel
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={handleBlur}
              onKeyDown={(event) => {
                if (event.key === 'Escape') cancel()
              }}
              error={error ?? undefined}
              maxLength={120}
              className="h-8 text-sm font-medium"
              autoComplete="off"
            />
          </form>
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => setEditing(true)}
            className="min-h-8 flex-1 truncate rounded px-2 py-1.5 text-left text-sm font-semibold text-fg hover:bg-surface-sunken disabled:hover:bg-transparent pointer-coarse:min-h-11"
          >
            {list.title}
            {list.wip_limit !== null && (
              <span className="ml-2 text-xs font-normal text-fg-muted">max {list.wip_limit}</span>
            )}
          </button>
        )}

        {editable && !editing && (
          <>
            <IconButton
              size="sm"
              label={list.archived ? `Restore ${list.title}` : `Archive ${list.title}`}
              icon={
                list.archived ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )
              }
              onClick={() =>
                updateList.mutate({ listId: list.id, patch: { archived: !list.archived } })
              }
            />
            {list.archived && (
              <IconButton
                size="sm"
                label={`Delete ${list.title} permanently`}
                icon={<Trash2 className="size-4" />}
                className="hover:bg-danger-soft hover:text-danger"
                onClick={() => setConfirmDelete(true)}
              />
            )}
          </>
        )}
      </header>

      <p className="rounded-md border border-dashed border-border px-2 py-6 text-center text-xs text-fg-muted">
        Cards arrive in the next phase
      </p>

      {updateList.isError && (
        <p role="alert" className="px-2 text-xs text-danger">
          {errorMessage(updateList.error)}
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${list.title}?`}
        description="Every card in this list is deleted with it."
        warning="This cannot be undone. Leaving it archived keeps the cards."
        confirmLabel="Delete list"
        loading={deleteList.isPending}
        error={deleteList.isError ? errorMessage(deleteList.error) : null}
        onConfirm={() => deleteList.mutate(list.id, { onSuccess: () => setConfirmDelete(false) })}
        onClose={() => {
          setConfirmDelete(false)
          deleteList.reset()
        }}
      />
    </section>
  )
}

type AddListFormProps = {
  onAdd: (title: string) => void
  pending: boolean
}

/** The trailing "add a list" column, matching where Trello puts it. */
export function AddListForm({ onAdd, pending }: AddListFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function submit(event: FormEvent) {
    event.preventDefault()
    const issue = firstIssue(listTitleSchema, title)
    setError(issue)
    if (issue) return
    onAdd(title)
    setTitle('')
  }

  if (!open) {
    return (
      <div className="w-72 shrink-0 snap-start">
        <Button className="w-full justify-start" onClick={() => setOpen(true)}>
          + Add a list
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-72 shrink-0 snap-start flex-col gap-2 rounded-lg bg-surface/95 p-2 backdrop-blur-sm"
      noValidate
    >
      <Input
        ref={inputRef}
        label="List title"
        hideLabel
        placeholder="e.g. In review"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setTitle('')
            setError(null)
          }
        }}
        error={error ?? undefined}
        maxLength={120}
        autoComplete="off"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" type="submit" loading={pending}>
          Add list
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false)
            setTitle('')
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
