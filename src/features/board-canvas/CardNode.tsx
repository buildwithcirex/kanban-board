import { memo, useRef } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { CalendarClock, MoveRight } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import type { BoardCard } from '@/lib/api/cards'
import type { TeamMember } from '@/lib/api/teams'
import { cn } from '@/lib/cn'
import { cardHeight, LIST_WIDTH } from './layout'
import { dueDateLabel, dueDateTone } from './dueDate'

export type CardNodeData = {
  card: BoardCard
  members: Map<string, TeamMember>
  /** Assigned to the signed-in user: gets the accent ring and a "You" chip. */
  isMine: boolean
  /** Filtered out rather than hidden, so the board keeps its shape. */
  dimmed: boolean
  isDragging: boolean
  /** Appeared since the last render: settles in instead of popping into place. */
  isNew: boolean
  editable: boolean
  onOpen: (cardId: string) => void
  onMove: (cardId: string) => void
}

export type CardNodeType = Node<CardNodeData, 'card'>

/**
 * The card front.
 *
 * Wrapped in `memo` and given node objects that keep their identity while nothing about them
 * changes — the proof of concept measured a 300-card drag at 20–44ms per step without that, and
 * 10ms with it.
 */
function CardNodeImpl({ data }: NodeProps<CardNodeType>) {
  const { card, members, isMine, dimmed, isDragging, isNew, editable } = data
  const due = dueDateLabel(card.due_date, card.due_complete)

  // The card is drawn at exactly the height the layout predicted for it. Letting the content
  // decide would drift a few pixels per card, and the drop index — which is computed from these
  // heights — would slowly stop matching what the eye sees down a long list.
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)

  const height = cardHeight({
    hasLabels: card.labels.length > 0,
    hasBadges: card.due_date !== null || card.assigneeIds.length > 0,
  })

  return (
    <div
      style={{ width: LIST_WIDTH - 16, height }}
      className={cn(
        'group relative cursor-grab overflow-hidden rounded-md border bg-surface text-left shadow-sm',
        'transition-[transform,box-shadow,opacity] duration-150 ease-out',
        isMine ? 'border-accent ring-1 ring-accent' : 'border-border',
        isDragging && 'scale-[1.03] rotate-[1.5deg] cursor-grabbing shadow-2xl',
        isNew && !isDragging && 'card-enter',
        dimmed && 'opacity-35',
        card.archived && 'border-dashed',
      )}
    >
      {/* ReactFlow wants handles to exist; the board has no edges, so they are hidden. */}
      <Handle type="target" position={Position.Top} className="!invisible" isConnectable={false} />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!invisible"
        isConnectable={false}
      />

      {card.labels.length > 0 && (
        <ul className="flex flex-wrap gap-1 px-2 pt-2" aria-label="Labels">
          {card.labels.map((label) => (
            <li
              key={label.id}
              className="h-2 w-8 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name || undefined}
            >
              <span className="sr-only">{label.name || label.color}</span>
            </li>
          ))}
        </ul>
      )}

      {/*
        The title deliberately does NOT carry `nodrag`: the body of a card is the natural place
        to grab it, and marking it nodrag left only a thin strip that could start a drag. Instead
        the pointer is measured, and a press that travelled is treated as a drag, not a click —
        which also keeps Enter on the focused button working as "open".
      */}
      <button
        type="button"
        className="block w-full px-2 py-2 text-left"
        onPointerDown={(event) => {
          pressOrigin.current = { x: event.clientX, y: event.clientY }
        }}
        onClick={(event) => {
          const origin = pressOrigin.current
          pressOrigin.current = null
          if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 4) return
          data.onOpen(card.id)
        }}
      >
        <span className="line-clamp-2 text-sm text-fg">{card.title}</span>
      </button>

      {(due || card.assigneeIds.length > 0 || isMine) && (
        <div className="flex items-center gap-2 px-2 pb-2">
          {due && (
            <span
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                dueDateTone(card.due_date, card.due_complete),
              )}
            >
              <CalendarClock className="size-3" aria-hidden />
              {due}
            </span>
          )}
          {isMine && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">
              You
            </span>
          )}
          <span className="ml-auto flex -space-x-1.5">
            {card.assigneeIds.slice(0, 3).map((userId) => {
              const member = members.get(userId)
              return (
                <Avatar
                  key={userId}
                  name={member?.name ?? '?'}
                  color={member?.color}
                  src={member?.avatarUrl}
                  size="sm"
                  className="ring-2 ring-surface"
                />
              )
            })}
            {card.assigneeIds.length > 3 && (
              <span className="flex size-6 items-center justify-center rounded-full bg-surface-sunken text-[0.625rem] font-semibold text-fg-muted ring-2 ring-surface">
                +{card.assigneeIds.length - 3}
              </span>
            )}
          </span>
        </div>
      )}

      {editable && (
        <button
          type="button"
          className="nodrag absolute top-1 right-1 rounded p-1 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-sunken hover:text-fg focus-visible:opacity-100 pointer-coarse:opacity-100"
          onClick={() => data.onMove(card.id)}
          aria-label={`Move ${card.title}`}
          title="Move…"
        >
          <MoveRight className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

export const CardNode = memo(CardNodeImpl)
