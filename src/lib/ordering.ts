import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

/**
 * Ordering for boards, lists and cards.
 *
 * Rows carry a fractional-index string in `position`, so moving one item rewrites exactly one
 * row — no renumbering of everything after it, and two people reordering at once do not fight
 * over the same values.
 *
 * The database columns are `collate "C"`, i.e. plain byte order, which is the order these keys
 * are built for. Sorting them in JavaScript therefore has to use the same rule: `localeCompare`
 * would disagree with Postgres for mixed-case keys, so comparisons here are `<` / `>` on the raw
 * strings.
 */

export type Positioned = { id: string; position: string }

/** Byte-order comparison, matching `collate "C"` in Postgres. */
export function comparePositions(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Sorts a copy by position, breaking ties on id so the order is never arbitrary. */
export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => comparePositions(a.position, b.position) || comparePositions(a.id, b.id),
  )
}

/**
 * A key that sorts between `before` and `after`. Pass `null` for an open end: `(null, first)`
 * prepends, `(last, null)` appends, `(null, null)` is the first item in an empty collection.
 */
export function positionBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after)
}

/** `count` keys in order between the two bounds — for seeding several rows at once. */
export function positionsBetween(
  before: string | null,
  after: string | null,
  count: number,
): string[] {
  if (count <= 0) return []
  return generateNKeysBetween(before, after, count)
}

/** The key for a new item placed after everything in `items`. */
export function positionAtEnd(items: readonly Positioned[]): string {
  const sorted = sortByPosition(items)
  return positionBetween(sorted.at(-1)?.position ?? null, null)
}

/** The key for a new item placed before everything in `items`. */
export function positionAtStart(items: readonly Positioned[]): string {
  const sorted = sortByPosition(items)
  return positionBetween(null, sorted[0]?.position ?? null)
}

/**
 * The key that lands an item at `index` within `items`, counting positions the item would occupy
 * after the move. `items` must not contain the item being moved — remove it first, so index 0
 * means "first" whichever direction it came from.
 */
export function positionAtIndex(items: readonly Positioned[], index: number): string {
  const sorted = sortByPosition(items)
  const clamped = Math.max(0, Math.min(index, sorted.length))
  return positionBetween(sorted[clamped - 1]?.position ?? null, sorted[clamped]?.position ?? null)
}
