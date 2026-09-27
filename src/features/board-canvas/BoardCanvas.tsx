import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BoardCard } from '@/lib/api/cards'
import type { List } from '@/lib/api/lists'
import type { TeamMember } from '@/lib/api/teams'
import { positionAtIndex, sortByPosition } from '@/lib/ordering'
import { CardNode, type CardNodeType } from './CardNode'
import { ListNode, type ListNodeType } from './ListNode'
import {
  CARDS_TOP,
  LIST_GAP,
  LIST_WIDTH,
  dropTargetAt,
  layoutBoard,
  listX,
  type DragPreview,
  type LayoutCard,
} from './layout'
import { useTouchDragArming } from './useTouchDragArming'

export type BoardFilter = {
  /** Show only cards assigned to the signed-in user, dimming the rest. */
  mineOnly: boolean
  /** Highlight one teammate's cards, dimming the rest. */
  memberId: string | null
}

export type BoardCanvasProps = {
  lists: List[]
  cards: BoardCard[]
  members: TeamMember[]
  myUserId: string | null
  editable: boolean
  filter: BoardFilter
  onMoveCard: (move: { cardId: string; listId: string; position: string }) => void
  onReorderList: (listId: string, position: string) => void
  onRenameList: (listId: string, title: string) => void
  onArchiveList: (listId: string, archived: boolean) => void
  onAddCard: (listId: string) => void
  onOpenCard: (cardId: string) => void
  onRequestMove: (cardId: string) => void
  /** Announced in the board's live region, e.g. after a drop. */
  announcement: string
}

const nodeTypes = { list: ListNode, card: CardNode }

function Canvas(props: BoardCanvasProps) {
  const {
    lists,
    cards,
    members,
    myUserId,
    editable,
    filter,
    onMoveCard,
    onReorderList,
    onRenameList,
    onArchiveList,
    onAddCard,
    onOpenCard,
    onRequestMove,
  } = props

  const { screenToFlowPosition } = useReactFlow()
  const [dragging, setDragging] = useState<string | null>(null)
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const { armedCardId, coarsePointer } = useTouchDragArming(editable)

  const memberIndex = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  )

  // The shape the layout maths works on: ids, order and how tall a card will be.
  const layoutCards = useMemo<LayoutCard[]>(
    () =>
      cards.map((card) => ({
        id: card.id,
        position: card.position,
        listId: card.list_id,
        hasLabels: card.labels.length > 0,
        hasBadges: card.due_date !== null || card.assigneeIds.length > 0,
      })),
    [cards],
  )

  const layout = useMemo(
    () => layoutBoard(lists, layoutCards, preview),
    [lists, layoutCards, preview],
  )

  const cardIndex = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])

  // Cards that appeared since the last render animate in. Tracked rather than derived from
  // `created_at` so a card someone else added arrives with the same movement.
  const [seenCardIds] = useState(() => new Set<string>())
  const freshCardIds = useMemo(() => {
    const fresh = new Set<string>()
    for (const card of cards) {
      if (!seenCardIds.has(card.id)) {
        fresh.add(card.id)
        seenCardIds.add(card.id)
      }
    }
    return fresh
  }, [cards, seenCardIds])

  /**
   * Node objects are cached and reused while nothing about them changes.
   *
   * This is load bearing, not an optimisation: the proof of concept measured a drag step on a
   * 300-card board at 20–44ms when every node object was rebuilt, and 10ms when unchanged cards
   * kept their identity. 44ms is three dropped frames per pointer move.
   */
  const [nodeCache] = useState(() => new Map<string, { key: string; node: Node }>())

  const nodes = useMemo<Node[]>(() => {
    const cache = nodeCache
    const orderedLists = sortByPosition(lists)

    const listNodes: ListNodeType[] = orderedLists.map((list, index) => ({
      id: `list:${list.id}`,
      type: 'list',
      position: { x: listX(index), y: 0 },
      data: {
        list,
        cardCount: layout.counts.get(list.id) ?? 0,
        height: layout.heights.get(list.id) ?? 0,
        editable,
        onRename: onRenameList,
        onArchive: onArchiveList,
        onAddCard,
      },
      draggable: editable,
      dragHandle: '.board-list-handle',
      selectable: false,
      zIndex: 0,
    }))

    const cardNodes: Node[] = []
    for (const card of cards) {
      const slot = layout.slots.get(card.id)
      if (!slot) continue

      const isDragging = card.id === dragging
      const isMine = myUserId !== null && card.assigneeIds.includes(myUserId)
      const dimmed =
        (filter.mineOnly && !isMine) ||
        (filter.memberId !== null && !card.assigneeIds.includes(filter.memberId))
      const draggable = editable && (!coarsePointer || armedCardId === card.id)

      const key = [
        slot.x,
        slot.y,
        isDragging,
        isMine,
        dimmed,
        draggable,
        freshCardIds.has(card.id),
        card.updated_at,
        card.assigneeIds.join(','),
        card.labels.map((label) => label.id).join(','),
      ].join('|')

      const cached = cache.get(card.id)
      if (cached && cached.key === key) {
        cardNodes.push(cached.node)
        continue
      }

      const node: CardNodeType = {
        id: card.id,
        type: 'card',
        position: { x: slot.x, y: slot.y },
        data: {
          card,
          members: memberIndex,
          isMine,
          dimmed,
          isDragging,
          isNew: freshCardIds.has(card.id),
          editable,
          onOpen: onOpenCard,
          onMove: onRequestMove,
        },
        draggable,
        selectable: false,
        // Everything except the card under the pointer slides to its new slot; that transition
        // is the whole animation (see index.css).
        className: isDragging ? 'board-card-dragging' : 'board-card',
        zIndex: isDragging ? 1000 : 1,
      }
      cache.set(card.id, { key, node })
      cardNodes.push(node)
    }

    return [...listNodes, ...cardNodes]
  }, [
    lists,
    cards,
    layout,
    dragging,
    editable,
    filter,
    myUserId,
    memberIndex,
    armedCardId,
    coarsePointer,
    onRenameList,
    onArchiveList,
    onAddCard,
    onOpenCard,
    onRequestMove,
    nodeCache,
    freshCardIds,
  ])

  const onNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    if (node.type === 'card') setDragging(node.id)
  }, [])

  const onNodeDrag: OnNodeDrag = useCallback(
    (event, node) => {
      if (node.type !== 'card') return
      const pointer = event as MouseEvent
      const point = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY })
      const target = dropTargetAt(lists, layoutCards, node.id, point)
      setPreview((current) =>
        current?.listId === target?.listId && current?.index === target?.index ? current : target,
      )
    },
    [screenToFlowPosition, lists, layoutCards],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type === 'list') {
        // Lists are reordered by where the column was dropped along the x axis.
        const ordered = sortByPosition(lists).filter((list) => `list:${list.id}` !== node.id)
        const index = Math.max(
          0,
          Math.min(ordered.length, Math.round(node.position.x / (LIST_WIDTH + LIST_GAP))),
        )
        const listId = node.id.slice('list:'.length)
        onReorderList(listId, positionAtIndex(ordered, index))
        return
      }

      if (node.type !== 'card') return

      if (preview) {
        const others = layoutCards.filter(
          (card) => card.listId === preview.listId && card.id !== node.id,
        )
        const card = cardIndex.get(node.id)
        const unchanged =
          card?.list_id === preview.listId &&
          sortByPosition(others.concat(layoutCards.filter((c) => c.id === node.id)))
            .map((c) => c.id)
            .indexOf(node.id) === preview.index

        if (!unchanged) {
          onMoveCard({
            cardId: node.id,
            listId: preview.listId,
            position: positionAtIndex(others, preview.index),
          })
        }
      }

      setDragging(null)
      setPreview(null)
    },
    [lists, layoutCards, cardIndex, preview, onMoveCard, onReorderList],
  )

  // A board wider than the screen is normal; start at the left rather than fitting everything.
  const defaultViewport = useMemo(() => ({ x: 16, y: 16, zoom: 1 }), [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      panOnDrag
      panOnScroll
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      minZoom={0.5}
      maxZoom={1.25}
      onlyRenderVisibleElements
      proOptions={{ hideAttribution: true }}
      defaultViewport={defaultViewport}
      aria-label="Board canvas"
      className="board-canvas"
    />
  )
}

/**
 * The board, drawn on a ReactFlow canvas.
 *
 * Lists and cards are separate nodes: a card has to be able to leave its column, which it cannot
 * do while it is a child of it. Positions are computed from the order in the database and never
 * stored (plan §3), so two people dragging at once cannot write conflicting coordinates.
 */
export function BoardCanvas(props: BoardCanvasProps) {
  const liveRegionRef = useRef<HTMLOutputElement>(null)

  // Announced out of band so a move is audible to a screen reader, whether it came from a drag
  // or from the "Move…" dialog.
  useEffect(() => {
    if (liveRegionRef.current) liveRegionRef.current.textContent = props.announcement
  }, [props.announcement])

  return (
    <div className="relative h-full w-full" style={{ minHeight: CARDS_TOP + 200 }}>
      <ReactFlowProvider>
        <Canvas {...props} />
      </ReactFlowProvider>
      <output ref={liveRegionRef} aria-live="polite" className="sr-only" />
    </div>
  )
}
