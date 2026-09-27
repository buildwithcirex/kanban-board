import { sortByPosition, type Positioned } from '@/lib/ordering'

/**
 * Where every list and card sits on the canvas.
 *
 * Card positions are computed, never stored: the database only knows a card's list and its
 * fractional index within it (docs/IMPLEMENTATION_PLAN.md §3). Everything here is pure so the
 * board's behaviour can be tested without a canvas.
 *
 * Heights are derived from a card's content rather than measured from the DOM. Measuring would
 * mean laying out, measuring, then laying out again — a feedback loop — and the card front has
 * only a few shapes, so a small function is both predictable and testable. Titles are clamped to
 * two lines to keep that true.
 */

export const LIST_WIDTH = 272
export const LIST_GAP = 16
export const LIST_HEADER_HEIGHT = 44
/** Where the first card sits, measured from the top of its list. */
export const CARDS_TOP = LIST_HEADER_HEIGHT + 8
export const CARD_GAP = 8
export const CARD_BASE_HEIGHT = 48
export const CARD_LABEL_ROW = 16
export const CARD_BADGE_ROW = 28
/** Space kept below the last card, so there is somewhere to drop at the end. */
export const LIST_FOOTER = 12
/** How much body an empty list still shows, so it can be dropped into. */
export const EMPTY_LIST_BODY = 56

export type LayoutList = Positioned
export type LayoutCard = Positioned & {
  listId: string
  hasLabels: boolean
  hasBadges: boolean
}

/** The card being dragged, and where it would land if dropped now. */
export type DragPreview = { cardId: string; listId: string; index: number }

export type Slot = { listId: string; listIndex: number; order: number; x: number; y: number }

export function cardHeight(card: Pick<LayoutCard, 'hasLabels' | 'hasBadges'>): number {
  return (
    CARD_BASE_HEIGHT + (card.hasLabels ? CARD_LABEL_ROW : 0) + (card.hasBadges ? CARD_BADGE_ROW : 0)
  )
}

export function listX(listIndex: number): number {
  return listIndex * (LIST_WIDTH + LIST_GAP)
}

/** Which list column an x coordinate falls in, clamped to the board. */
export function listIndexAtX(x: number, listCount: number): number {
  if (listCount <= 0) return 0
  const column = Math.floor((x + LIST_GAP / 2) / (LIST_WIDTH + LIST_GAP))
  return Math.max(0, Math.min(listCount - 1, column))
}

/**
 * Where a card dropped at `y` should be inserted among `cards` (already in order).
 *
 * The midpoint of each card is the boundary: above it the newcomer goes before, below it after.
 * Heights vary, so this walks the stack rather than dividing by a constant.
 */
export function insertIndexAtY(cards: readonly LayoutCard[], y: number): number {
  let top = CARDS_TOP
  for (let index = 0; index < cards.length; index++) {
    const height = cardHeight(cards[index]!)
    if (y < top + height / 2) return index
    top += height + CARD_GAP
  }
  return cards.length
}

/** Cards of one list in order, excluding any card currently being dragged out of it. */
function cardsOfList(
  cards: readonly LayoutCard[],
  listId: string,
  excludeCardId?: string,
): LayoutCard[] {
  return sortByPosition(cards.filter((card) => card.listId === listId && card.id !== excludeCardId))
}

export type BoardLayout = {
  /** Lists in display order. */
  listOrder: string[]
  /** Card id → where it should be drawn. */
  slots: Map<string, Slot>
  /** List id → how many cards it holds, counting the drag preview. */
  counts: Map<string, number>
  /** List id → how tall its column should be, so it sits behind its cards. */
  heights: Map<string, number>
}

/**
 * The whole board's geometry, honouring a live drag so the gap opens where the card would land.
 *
 * The dragged card is given a slot too, but the canvas leaves it under the pointer and only uses
 * the slot when the drag ends.
 */
export function layoutBoard(
  lists: readonly LayoutList[],
  cards: readonly LayoutCard[],
  preview: DragPreview | null,
): BoardLayout {
  const orderedLists = sortByPosition(lists)
  const slots = new Map<string, Slot>()
  const counts = new Map<string, number>()
  const heights = new Map<string, number>()

  orderedLists.forEach((list, listIndex) => {
    const inList = cardsOfList(cards, list.id, preview?.cardId)

    if (preview && preview.listId === list.id) {
      const dragged = cards.find((card) => card.id === preview.cardId)
      if (dragged) {
        inList.splice(Math.max(0, Math.min(preview.index, inList.length)), 0, dragged)
      }
    }

    counts.set(list.id, inList.length)

    let y = CARDS_TOP
    inList.forEach((card, order) => {
      slots.set(card.id, { listId: list.id, listIndex, order, x: listX(listIndex) + 8, y })
      y += cardHeight(card) + CARD_GAP
    })

    // The column is a backdrop behind its cards, with room left for an empty list to still be a
    // drop target.
    heights.set(list.id, Math.max(y + LIST_FOOTER, CARDS_TOP + EMPTY_LIST_BODY))
  })

  return { listOrder: orderedLists.map((list) => list.id), slots, counts, heights }
}

/**
 * Turns a pointer position into a drop target.
 *
 * Returns null when the board has no lists, which is the only case with nowhere to drop.
 */
export function dropTargetAt(
  lists: readonly LayoutList[],
  cards: readonly LayoutCard[],
  draggedCardId: string,
  point: { x: number; y: number },
): DragPreview | null {
  const orderedLists = sortByPosition(lists)
  if (orderedLists.length === 0) return null

  const listIndex = listIndexAtX(point.x, orderedLists.length)
  const list = orderedLists[listIndex]!
  const inList = cardsOfList(cards, list.id, draggedCardId)

  return { cardId: draggedCardId, listId: list.id, index: insertIndexAtY(inList, point.y) }
}
