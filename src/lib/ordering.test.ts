import { describe, expect, it } from 'vitest'
import {
  comparePositions,
  positionAtEnd,
  positionAtIndex,
  positionAtStart,
  positionBetween,
  positionsBetween,
  sortByPosition,
  type Positioned,
} from './ordering'

const item = (id: string, position: string): Positioned => ({ id, position })

/** Applies a move and returns the resulting order of ids, the way the UI would render it. */
function orderAfterMove(items: Positioned[], movedId: string, index: number): string[] {
  const rest = items.filter((i) => i.id !== movedId)
  const position = positionAtIndex(rest, index)
  return sortByPosition([...rest, { id: movedId, position }]).map((i) => i.id)
}

describe('comparePositions', () => {
  it('orders by bytes, not by locale', () => {
    // Postgres compares these columns with `collate "C"`, where uppercase sorts before lowercase.
    // localeCompare puts 'a' before 'Z', which would disagree with the server.
    expect(comparePositions('Z', 'a')).toBeLessThan(0)
    expect('Z'.localeCompare('a')).toBeGreaterThan(0)
  })

  it('reports equality', () => {
    expect(comparePositions('a0', 'a0')).toBe(0)
  })
})

describe('sortByPosition', () => {
  it('sorts by position', () => {
    const items = [item('c', 'a2'), item('a', 'a0'), item('b', 'a1')]
    expect(sortByPosition(items).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties on id so concurrent inserts still have one stable order', () => {
    const items = [item('b', 'a0'), item('a', 'a0')]
    expect(sortByPosition(items).map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('does not mutate its input', () => {
    const items = [item('c', 'a2'), item('a', 'a0')]
    sortByPosition(items)
    expect(items.map((i) => i.id)).toEqual(['c', 'a'])
  })
})

describe('positionBetween', () => {
  it('lands strictly between its bounds', () => {
    const key = positionBetween('a0', 'a1')
    expect(comparePositions('a0', key)).toBeLessThan(0)
    expect(comparePositions(key, 'a1')).toBeLessThan(0)
  })

  it('appends and prepends with an open end', () => {
    expect(comparePositions(positionBetween('a0', null), 'a0')).toBeGreaterThan(0)
    expect(comparePositions(positionBetween(null, 'a0'), 'a0')).toBeLessThan(0)
  })

  it('survives repeated insertion at the same spot', () => {
    // The pathological case for ordering schemes: always dropping between the same two rows.
    let before = 'a0'
    const after = 'a1'
    for (let i = 0; i < 50; i++) {
      const next = positionBetween(before, after)
      expect(comparePositions(before, next)).toBeLessThan(0)
      expect(comparePositions(next, after)).toBeLessThan(0)
      before = next
    }
  })
})

describe('positionsBetween', () => {
  it('returns the requested number of keys, in order', () => {
    const keys = positionsBetween(null, null, 3)
    expect(keys).toHaveLength(3)
    expect([...keys].sort(comparePositions)).toEqual(keys)
  })

  it('matches the positions create_board seeds its default lists with', () => {
    // The migration hard-codes 'a0' / 'a1' / 'a2'; if the library ever changed, appending a
    // fourth list in the app would land in the wrong place.
    expect(positionsBetween(null, null, 3)).toEqual(['a0', 'a1', 'a2'])
  })

  it('returns nothing for a non-positive count', () => {
    expect(positionsBetween(null, null, 0)).toEqual([])
    expect(positionsBetween(null, null, -1)).toEqual([])
  })
})

describe('positionAtEnd / positionAtStart', () => {
  const items = [item('b', 'a1'), item('a', 'a0')]

  it('places a new item last or first regardless of input order', () => {
    expect(sortByPosition([...items, item('new', positionAtEnd(items))]).at(-1)?.id).toBe('new')
    expect(sortByPosition([...items, item('new', positionAtStart(items))])[0]?.id).toBe('new')
  })

  it('handles an empty collection', () => {
    expect(positionAtEnd([])).toBe(positionBetween(null, null))
    expect(positionAtStart([])).toBe(positionBetween(null, null))
  })
})

describe('positionAtIndex', () => {
  const board = [item('a', 'a0'), item('b', 'a1'), item('c', 'a2'), item('d', 'a3')]

  it('moves an item to the front', () => {
    expect(orderAfterMove(board, 'c', 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves an item to the end', () => {
    expect(orderAfterMove(board, 'a', 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('moves an item into the middle, forwards and backwards', () => {
    expect(orderAfterMove(board, 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(orderAfterMove(board, 'd', 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('leaves the order alone when an item lands where it already was', () => {
    expect(orderAfterMove(board, 'b', 1)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('clamps an index outside the collection instead of throwing', () => {
    expect(orderAfterMove(board, 'a', 99)).toEqual(['b', 'c', 'd', 'a'])
    expect(orderAfterMove(board, 'd', -5)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('works on an empty collection', () => {
    expect(() => positionAtIndex([], 0)).not.toThrow()
  })
})
