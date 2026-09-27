import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { type Node, type NodeProps } from '@xyflow/react'
import { Archive, Plus } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/cn'
import type { List } from '@/lib/api/lists'
import { LIST_HEADER_HEIGHT, LIST_WIDTH } from './layout'

export type ListNodeData = {
  list: List
  cardCount: number
  /** Computed by the layout so the column sits behind its cards. */
  height: number
  editable: boolean
  onRename: (listId: string, title: string) => void
  onArchive: (listId: string, archived: boolean) => void
  onAddCard: (listId: string) => void
}

export type ListNodeType = Node<ListNodeData, 'list'>

/**
 * A list column: just the header and the backdrop. The cards are separate nodes on top, so a card
 * can be dragged out of its list without fighting the list's own drag.
 *
 * Only the title starts a list drag (`dragHandle` in the node), which leaves the buttons and the
 * rename field clickable.
 */
function ListNodeImpl({ data }: NodeProps<ListNodeType>) {
  const { list, cardCount, editable, height } = data
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(list.title)
  const inputRef = useRef<HTMLInputElement>(null)

  // Adopting a title saved elsewhere (a teammate, or the same list re-rendered) during render
  // rather than in an effect avoids showing the stale one for a frame.
  const [lastTitle, setLastTitle] = useState(list.title)
  if (list.title !== lastTitle) {
    setLastTitle(list.title)
    setTitle(list.title)
  }

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function save(event?: FormEvent) {
    event?.preventDefault()
    const next = title.trim()
    if (next && next !== list.title) data.onRename(list.id, next)
    else setTitle(list.title)
    setEditing(false)
  }

  const overLimit = list.wip_limit !== null && cardCount > list.wip_limit

  return (
    <div
      style={{ width: LIST_WIDTH, height }}
      className="flex flex-col rounded-lg border border-border bg-surface/95 shadow-sm backdrop-blur-sm"
    >
      <div style={{ height: LIST_HEADER_HEIGHT }} className="flex items-center gap-1 px-2">
        {editing ? (
          <form onSubmit={save} className="flex-1">
            <input
              ref={inputRef}
              // `nodrag nopan` stops the canvas stealing the pointer while typing.
              className="nodrag nopan h-8 w-full rounded border border-border-strong bg-surface px-2 text-sm font-semibold text-fg focus-visible:border-accent focus-visible:outline-none"
              value={title}
              aria-label={`Rename ${list.title}`}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => save()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setTitle(list.title)
                  setEditing(false)
                }
              }}
            />
          </form>
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => setEditing(true)}
            // The drag handle: grabbing the title moves the whole column.
            className="board-list-handle min-h-8 flex-1 truncate rounded px-2 py-1 text-left text-sm font-semibold text-fg hover:bg-surface-sunken disabled:hover:bg-transparent pointer-coarse:min-h-11"
          >
            {list.title}
          </button>
        )}

        <span
          className={cn(
            'nodrag shrink-0 rounded px-1.5 text-xs tabular-nums',
            overLimit ? 'bg-danger/15 font-medium text-danger' : 'text-fg-muted',
          )}
          title={
            list.wip_limit !== null
              ? `${cardCount} of a ${list.wip_limit} card limit`
              : `${cardCount} cards`
          }
        >
          {cardCount}
          {list.wip_limit !== null && `/${list.wip_limit}`}
        </span>

        {editable && !editing && (
          <>
            <IconButton
              size="sm"
              className="nodrag"
              label={`Add a card to ${list.title}`}
              icon={<Plus className="size-4" />}
              onClick={() => data.onAddCard(list.id)}
            />
            <IconButton
              size="sm"
              className="nodrag"
              label={`Archive ${list.title}`}
              icon={<Archive className="size-4" />}
              onClick={() => data.onArchive(list.id, true)}
            />
          </>
        )}
      </div>
    </div>
  )
}

export const ListNode = memo(ListNodeImpl)
