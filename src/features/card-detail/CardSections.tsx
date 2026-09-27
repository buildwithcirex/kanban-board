import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { boardColors } from '@/features/boards/boardSchema'
import type { Attachment, CardDetail, CardPriority, Label } from '@/lib/api/cardDetail'
import type { TeamMember } from '@/lib/api/teams'
import { cn } from '@/lib/cn'
import { positionAtEnd } from '@/lib/ordering'

/** A titled block in the sheet. Every section looks the same so the sheet reads as a list. */
export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 border-b border-border py-4 first:pt-0 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------

export function DescriptionSection({
  value,
  editable,
  pending,
  onSave,
}: {
  value: string | null
  editable: boolean
  pending: boolean
  onSave: (description: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  if (!editing) {
    return (
      <Section title="Description">
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            setDraft(value ?? '')
            setEditing(true)
          }}
          className="min-h-11 w-full rounded-md border border-dashed border-border px-3 py-2 text-left text-sm whitespace-pre-wrap text-fg hover:bg-surface-sunken disabled:hover:bg-transparent"
        >
          {value || <span className="text-fg-muted">Add a more detailed description…</span>}
        </button>
      </Section>
    )
  }

  return (
    <Section title="Description">
      <Textarea
        label="Description"
        hideLabel
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={20000}
        className="min-h-32"
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={pending}
          onClick={() => {
            onSave(draft)
            setEditing(false)
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------

export function AssigneesSection({
  assigneeIds,
  members,
  editable,
  myUserId,
  onToggle,
}: {
  assigneeIds: string[]
  members: TeamMember[]
  editable: boolean
  myUserId: string | null
  onToggle: (userId: string, assign: boolean) => void
}) {
  const assigned = new Set(assigneeIds)

  return (
    <Section title="Assignees">
      {members.length === 0 ? (
        <p className="text-sm text-fg-muted">Nobody else is in this team yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {members.map((member) => {
            const on = assigned.has(member.userId)
            return (
              <li key={member.userId}>
                <button
                  type="button"
                  disabled={!editable}
                  aria-pressed={on}
                  onClick={() => onToggle(member.userId, !on)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left transition-colors',
                    on ? 'bg-accent-soft' : 'hover:bg-surface-sunken',
                    'disabled:hover:bg-transparent',
                  )}
                >
                  <Avatar
                    name={member.name}
                    color={member.color}
                    src={member.avatarUrl}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">
                    {member.name}
                    {member.userId === myUserId && (
                      <span className="ml-2 text-xs text-fg-muted">You</span>
                    )}
                  </span>
                  {on && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------

export function LabelsSection({
  labels,
  labelIds,
  editable,
  onToggle,
  onCreate,
  pending,
}: {
  labels: Label[]
  labelIds: string[]
  editable: boolean
  onToggle: (labelId: string, on: boolean) => void
  onCreate: (name: string, color: string, position: string) => void
  pending: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(boardColors[0])
  const on = new Set(labelIds)

  return (
    <Section
      title="Labels"
      action={
        editable && (
          <Button size="sm" variant="ghost" onClick={() => setAdding((value) => !value)}>
            {adding ? 'Cancel' : 'New label'}
          </Button>
        )
      }
    >
      {labels.length === 0 && !adding && (
        <p className="text-sm text-fg-muted">This board has no labels yet.</p>
      )}

      {labels.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <li key={label.id}>
              <button
                type="button"
                disabled={!editable}
                aria-pressed={on.has(label.id)}
                onClick={() => onToggle(label.id, !on.has(label.id))}
                className={cn(
                  'flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-white pointer-coarse:min-h-11',
                  !on.has(label.id) && 'opacity-45',
                )}
                style={{ backgroundColor: label.color }}
              >
                {on.has(label.id) && <Check className="size-3.5" aria-hidden />}
                {label.name || label.color}
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form
          className="flex flex-col gap-2 rounded-md border border-border p-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (!name.trim()) return
            onCreate(name, color, positionAtEnd(labels))
            setName('')
            setAdding(false)
          }}
        >
          <Input
            label="Label name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {boardColors.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                aria-pressed={swatch === color}
                onClick={() => setColor(swatch)}
                className={cn(
                  'size-9 rounded-md pointer-coarse:size-11',
                  swatch === color && 'ring-2 ring-fg',
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
          <Button size="sm" variant="primary" type="submit" loading={pending}>
            Add label
          </Button>
        </form>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------

const priorities: CardPriority[] = ['none', 'low', 'medium', 'high', 'urgent']

export function DatesSection({
  detail,
  editable,
  onChange,
}: {
  detail: CardDetail
  editable: boolean
  onChange: (fields: {
    dueDate?: string | null
    dueComplete?: boolean
    priority?: CardPriority
  }) => void
}) {
  // <input type="datetime-local"> wants a local, second-less string; the column is a timestamptz.
  const toLocal = (iso: string | null) => {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  return (
    <Section title="Due date and priority">
      {/*
        Input and Select put `className` on the control itself, not the wrapper, so sizing goes on
        a wrapping element — `flex-1` on the control collapses its height to zero basis.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:flex-1">
          <Input
            label="Due"
            type="datetime-local"
            disabled={!editable}
            value={toLocal(detail.card.due_date)}
            onChange={(event) =>
              onChange({
                dueDate: event.target.value ? new Date(event.target.value).toISOString() : null,
              })
            }
          />
        </div>
        <div className="sm:w-36">
          <Select
            label="Priority"
            disabled={!editable}
            value={detail.card.priority}
            onChange={(event) => onChange({ priority: event.target.value as CardPriority })}
          >
            {priorities.map((level) => (
              <option key={level} value={level}>
                {level === 'none' ? 'No priority' : level[0]!.toUpperCase() + level.slice(1)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {detail.card.due_date && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            disabled={!editable}
            checked={detail.card.due_complete}
            onChange={(event) => onChange({ dueComplete: event.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          Mark the due date as done
        </label>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------

export function ChecklistsSection({
  detail,
  editable,
  onAddChecklist,
  onRemoveChecklist,
  onAddItem,
  onToggleItem,
  onRemoveItem,
}: {
  detail: CardDetail
  editable: boolean
  onAddChecklist: (title: string, position: string) => void
  onRemoveChecklist: (checklistId: string) => void
  onAddItem: (checklistId: string, text: string, position: string) => void
  onToggleItem: (itemId: string, done: boolean) => void
  onRemoveItem: (itemId: string) => void
}) {
  const [newList, setNewList] = useState('')
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({})

  return (
    <Section title="Checklists">
      {detail.checklists.map((checklist) => {
        const done = checklist.items.filter((item) => item.done).length
        return (
          <div key={checklist.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                {checklist.title}
              </h4>
              <span className="shrink-0 text-xs text-fg-muted tabular-nums">
                {done}/{checklist.items.length}
              </span>
              {editable && (
                <IconButton
                  size="sm"
                  label={`Delete ${checklist.title}`}
                  icon={<Trash2 className="size-4" />}
                  className="hover:bg-danger-soft hover:text-danger"
                  onClick={() => onRemoveChecklist(checklist.id)}
                />
              )}
            </div>

            <ul className="flex flex-col">
              {checklist.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <label className="flex min-h-11 flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={item.done}
                      onChange={(event) => onToggleItem(item.id, event.target.checked)}
                      className="size-4 shrink-0 accent-[var(--accent)]"
                    />
                    <span
                      className={cn(
                        'min-w-0 break-words',
                        item.done && 'text-fg-muted line-through',
                      )}
                    >
                      {item.text}
                    </span>
                  </label>
                  {editable && (
                    <IconButton
                      size="sm"
                      label={`Remove ${item.text}`}
                      icon={<X className="size-4" />}
                      onClick={() => onRemoveItem(item.id)}
                    />
                  )}
                </li>
              ))}
            </ul>

            {editable && (
              <form
                className="flex gap-2"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault()
                  const text = itemDrafts[checklist.id]?.trim()
                  if (!text) return
                  onAddItem(checklist.id, text, positionAtEnd(checklist.items))
                  setItemDrafts((drafts) => ({ ...drafts, [checklist.id]: '' }))
                }}
              >
                <Input
                  label={`Add an item to ${checklist.title}`}
                  hideLabel
                  placeholder="Add an item"
                  value={itemDrafts[checklist.id] ?? ''}
                  onChange={(event) =>
                    setItemDrafts((drafts) => ({ ...drafts, [checklist.id]: event.target.value }))
                  }
                  maxLength={512}
                  wrapperClassName="flex-1"
                />
                <Button size="sm" type="submit" icon={<Plus className="size-4" />}>
                  Add
                </Button>
              </form>
            )}
          </div>
        )
      })}

      {editable && (
        <form
          className="flex gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            if (!newList.trim()) return
            onAddChecklist(newList, positionAtEnd(detail.checklists))
            setNewList('')
          }}
        >
          <Input
            label="New checklist"
            hideLabel
            placeholder="New checklist"
            value={newList}
            onChange={(event) => setNewList(event.target.value)}
            maxLength={120}
            wrapperClassName="flex-1"
          />
          <Button size="sm" type="submit">
            Add list
          </Button>
        </form>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------

export function AttachmentsSection({
  attachments,
  editable,
  uploading,
  error,
  onUpload,
  onOpen,
  onRemove,
}: {
  attachments: Attachment[]
  editable: boolean
  uploading: boolean
  error: string | null
  onUpload: (file: File) => void
  onOpen: (attachment: Attachment) => void
  onRemove: (attachment: Attachment) => void
}) {
  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  return (
    <Section title="Attachments">
      {attachments.length === 0 && <p className="text-sm text-fg-muted">No files yet.</p>}

      <ul className="flex flex-col gap-1">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(attachment)}
              className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-sunken"
            >
              <Paperclip className="size-4 shrink-0 text-fg-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-fg">{attachment.name}</span>
              <span className="shrink-0 text-xs text-fg-muted">{formatSize(attachment.size)}</span>
            </button>
            {editable && (
              <IconButton
                size="sm"
                label={`Remove ${attachment.name}`}
                icon={<Trash2 className="size-4" />}
                className="hover:bg-danger-soft hover:text-danger"
                onClick={() => onRemove(attachment)}
              />
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <label className="inline-flex">
          <input
            type="file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onUpload(file)
              event.target.value = ''
            }}
          />
          <span className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-3 text-sm font-medium text-fg hover:bg-surface-sunken">
            {uploading ? <Spinner /> : <Paperclip className="size-4" aria-hidden />}
            Attach a file
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </Section>
  )
}
