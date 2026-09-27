import { describe, expect, it } from 'vitest'
import {
  CARDS_TOP,
  CARD_GAP,
  LIST_GAP,
  LIST_WIDTH,
  cardHeight,
  dropTargetAt,
  insertIndexAtY,
  layoutBoard,
  listIndexAtX,
  listX,
  type LayoutCard,
  type LayoutList,
} from './layout'

const list = (id: string, position: string): LayoutList => ({ id, position })

const card = (
  id: string,
  listId: string,
  position: string,
  extras: Partial<Pick<LayoutCard, 'hasLabels' | 'hasBadges'>> = {},
): LayoutCard => ({
  id,
  listId,
  position,
  hasLabels: false,
  hasBadges: false,
  ...extras,
})

const lists = [list('todo', 'a0'), list('doing', 'a1'), list('done', 'a2')]
const cards = [
  card('c1', 'todo', 'a0'),
  card('c2', 'todo', 'a1'),
  card('c3', 'todo', 'a2'),
  card('d1', 'doing', 'a0'),
]

/** Card ids per list, in display order — what the board actually shows. */
function render(preview: Parameters<typeof layoutBoard>[2] = null) {
  const { slots, listOrder } = layoutBoard(lists, cards, preview)
  return listOrder.map((listId) =>
    [...slots.entries()]
      .filter(([, slot]) => slot.listId === listId)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id]) => id),
  )
}

describe('cardHeight', () => {
  it('grows with labels and badges', () => {
    const plain = cardHeight({ hasLabels: false, hasBadges: false })
    expect(cardHeight({ hasLabels: true, hasBadges: false })).toBeGreaterThan(plain)
    expect(cardHeight({ hasLabels: true, hasBadges: true })).toBeGreaterThan(
      cardHeight({ hasLabels: true, hasBadges: false }),
    )
  })
})

describe('listIndexAtX', () => {
  it('maps a point inside a column to that column', () => {
    expect(listIndexAtX(listX(0) + 10, 3)).toBe(0)
    expect(listIndexAtX(listX(1) + 10, 3)).toBe(1)
    expect(listIndexAtX(listX(2) + 10, 3)).toBe(2)
  })

  it('assigns the gap between columns to the nearer one', () => {
    // Just past the right edge of column 0 still belongs to column 0.
    expect(listIndexAtX(LIST_WIDTH + 1, 3)).toBe(0)
    // Past the midpoint of the gap it belongs to column 1.
    expect(listIndexAtX(LIST_WIDTH + LIST_GAP, 3)).toBe(1)
  })

  it('clamps beyond either end rather than returning nothing', () => {
    expect(listIndexAtX(-9999, 3)).toBe(0)
    expect(listIndexAtX(9999, 3)).toBe(2)
  })

  it('survives a board with no lists', () => {
    expect(listIndexAtX(100, 0)).toBe(0)
  })
})

describe('insertIndexAtY', () => {
  const stack = [card('a', 'l', 'a0'), card('b', 'l', 'a1'), card('c', 'l', 'a2')]
  const height = cardHeight(stack[0]!)

  it('drops above the first card at the top of the list', () => {
    expect(insertIndexAtY(stack, CARDS_TOP - 20)).toBe(0)
    expect(insertIndexAtY(stack, CARDS_TOP + 1)).toBe(0)
  })

  it('uses each card’s midpoint as the boundary', () => {
    expect(insertIndexAtY(stack, CARDS_TOP + height / 2 - 1)).toBe(0)
    expect(insertIndexAtY(stack, CARDS_TOP + height / 2 + 1)).toBe(1)
  })

  it('drops at the end below the last card', () => {
    expect(insertIndexAtY(stack, CARDS_TOP + 10 * (height + CARD_GAP))).toBe(3)
  })

  it('accounts for taller cards rather than assuming a fixed row', () => {
    const mixed = [
      card('tall', 'l', 'a0', { hasLabels: true, hasBadges: true }),
      card('short', 'l', 'a1'),
    ]
    const tall = cardHeight(mixed[0]!)
    // A y that would be index 1 for uniform cards is still index 0 under a taller first card.
    expect(insertIndexAtY(mixed, CARDS_TOP + tall / 2 - 1)).toBe(0)
    expect(insertIndexAtY(mixed, CARDS_TOP + tall / 2 + 1)).toBe(1)
  })

  it('returns 0 for an empty list', () => {
    expect(insertIndexAtY([], 500)).toBe(0)
  })
})

describe('layoutBoard', () => {
  it('places lists left to right by position, and cards down each one', () => {
    const { slots, listOrder } = layoutBoard(lists, cards, null)
    expect(listOrder).toEqual(['todo', 'doing', 'done'])

    expect(slots.get('c1')).toMatchObject({ listIndex: 0, order: 0, y: CARDS_TOP })
    expect(slots.get('c2')!.y).toBeGreaterThan(slots.get('c1')!.y)
    expect(slots.get('d1')!.x).toBeGreaterThan(slots.get('c1')!.x)
  })

  it('counts the cards in each list', () => {
    const { counts } = layoutBoard(lists, cards, null)
    expect(counts.get('todo')).toBe(3)
    expect(counts.get('doing')).toBe(1)
    expect(counts.get('done')).toBe(0)
  })

  it('renders every card exactly once', () => {
    expect(render().flat().sort()).toEqual(['c1', 'c2', 'c3', 'd1'])
  })

  describe('while a card is being dragged', () => {
    it('opens a gap at the target index in another list', () => {
      expect(render({ cardId: 'c1', listId: 'doing', index: 0 })).toEqual([
        ['c2', 'c3'],
        ['c1', 'd1'],
        [],
      ])
    })

    it('appends when the index is past the end', () => {
      expect(render({ cardId: 'c1', listId: 'doing', index: 99 })).toEqual([
        ['c2', 'c3'],
        ['d1', 'c1'],
        [],
      ])
    })

    it('reorders within the same list without duplicating the card', () => {
      expect(render({ cardId: 'c1', listId: 'todo', index: 2 })).toEqual([
        ['c2', 'c3', 'c1'],
        ['d1'],
        [],
      ])
    })

    it('leaves the order alone when the card hovers where it already is', () => {
      expect(render({ cardId: 'c2', listId: 'todo', index: 1 })).toEqual([
        ['c1', 'c2', 'c3'],
        ['d1'],
        [],
      ])
    })

    it('handles a drag into an empty list', () => {
      expect(render({ cardId: 'c1', listId: 'done', index: 0 })).toEqual([
        ['c2', 'c3'],
        ['d1'],
        ['c1'],
      ])
    })

    it('ignores a preview for a card that is no longer there', () => {
      expect(render({ cardId: 'gone', listId: 'doing', index: 0 })).toEqual([
        ['c1', 'c2', 'c3'],
        ['d1'],
        [],
      ])
    })
  })
})

describe('dropTargetAt', () => {
  it('reads a pointer inside the second column as that list', () => {
    const target = dropTargetAt(lists, cards, 'c1', { x: listX(1) + 20, y: CARDS_TOP + 2 })
    expect(target).toEqual({ cardId: 'c1', listId: 'doing', index: 0 })
  })

  it('does not count the dragged card when working out the index', () => {
    // Dragging c1 to the bottom of its own list: three cards, but only two others to pass.
    const height = cardHeight(cards[0]!)
    const target = dropTargetAt(lists, cards, 'c1', {
      x: listX(0) + 20,
      y: CARDS_TOP + 5 * (height + CARD_GAP),
    })
    expect(target).toEqual({ cardId: 'c1', listId: 'todo', index: 2 })
  })

  it('clamps a pointer dragged off the side of the board', () => {
    expect(dropTargetAt(lists, cards, 'c1', { x: -500, y: 0 })?.listId).toBe('todo')
    expect(dropTargetAt(lists, cards, 'c1', { x: 99999, y: 0 })?.listId).toBe('done')
  })

  it('returns nothing when there is nowhere to drop', () => {
    expect(dropTargetAt([], cards, 'c1', { x: 0, y: 0 })).toBeNull()
  })
})
