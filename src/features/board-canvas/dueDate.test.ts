import { describe, expect, it } from 'vitest'
import { dueDateLabel, dueTone } from './dueDate'

const now = new Date('2026-09-27T12:00:00.000Z')
const at = (ms: number) => new Date(now.getTime() + ms).toISOString()
const HOUR = 3600_000
const DAY = 24 * HOUR

describe('dueTone', () => {
  it('has nothing to say without a due date', () => {
    expect(dueTone(null, false, now)).toBeNull()
  })

  it('reports a completed date as done, however overdue it is', () => {
    expect(dueTone(at(-10 * DAY), true, now)).toBe('complete')
  })

  it('separates overdue, the next 24 hours, and later', () => {
    expect(dueTone(at(-HOUR), false, now)).toBe('overdue')
    expect(dueTone(at(2 * HOUR), false, now)).toBe('soon')
    expect(dueTone(at(3 * DAY), false, now)).toBe('upcoming')
  })

  it('treats an unparseable date as no date rather than throwing', () => {
    expect(dueTone('not a date', false, now)).toBeNull()
  })
})

describe('dueDateLabel', () => {
  it.each([
    [30 * 60_000, '30m left'],
    [-30 * 60_000, '30m overdue'],
    [3 * HOUR, '3h left'],
    [-3 * HOUR, '3h overdue'],
    [2 * DAY, '2d left'],
    [-2 * DAY, '2d overdue'],
  ])('describes %i ms away as "%s"', (delta, expected) => {
    expect(dueDateLabel(at(delta), false, now)).toBe(expected)
  })

  it('falls back to a date once it is more than a week out', () => {
    expect(dueDateLabel(at(30 * DAY), false, now)).toMatch(/\d/)
    expect(dueDateLabel(at(30 * DAY), false, now)).not.toContain('left')
  })

  it('says Done for a completed date', () => {
    expect(dueDateLabel(at(-DAY), true, now)).toBe('Done')
  })
})
