import { describe, expect, it } from 'vitest'
import { bucketFor, groupTasks } from './grouping'

// Mid-afternoon, so "today" has hours on either side of it.
const now = new Date('2026-09-27T15:00:00')
const at = (iso: string) => new Date(iso).toISOString()

describe('bucketFor', () => {
  it('puts a card with no due date in someday rather than dropping it', () => {
    expect(bucketFor(null, false, now)).toBe('someday')
  })

  it('treats a completed due date as no longer waiting on a date', () => {
    expect(bucketFor(at('2026-09-20T09:00:00'), true, now)).toBe('someday')
  })

  it('counts anything before today as overdue, however recent', () => {
    expect(bucketFor(at('2026-09-26T23:59:00'), false, now)).toBe('overdue')
    expect(bucketFor(at('2026-01-01T00:00:00'), false, now)).toBe('overdue')
  })

  it('counts the whole of today as today, before and after now', () => {
    expect(bucketFor(at('2026-09-27T00:00:00'), false, now)).toBe('today')
    expect(bucketFor(at('2026-09-27T09:00:00'), false, now)).toBe('today')
    expect(bucketFor(at('2026-09-27T23:59:00'), false, now)).toBe('today')
  })

  it('counts the next seven days as this week', () => {
    expect(bucketFor(at('2026-09-28T09:00:00'), false, now)).toBe('week')
    expect(bucketFor(at('2026-10-03T23:00:00'), false, now)).toBe('week')
  })

  it('counts the eighth day onwards as later', () => {
    expect(bucketFor(at('2026-10-04T09:00:00'), false, now)).toBe('later')
    expect(bucketFor(at('2027-01-01T09:00:00'), false, now)).toBe('later')
  })

  it('treats an unparseable date as someday rather than throwing', () => {
    expect(bucketFor('not a date', false, now)).toBe('someday')
  })

  it('uses the reader’s own midnight, not UTC', () => {
    // 23:30 local today is still "today" wherever the machine is, even though it may already be
    // tomorrow in UTC.
    const lateToday = new Date('2026-09-27T23:30:00')
    expect(bucketFor(lateToday.toISOString(), false, now)).toBe('today')
  })
})

describe('groupTasks', () => {
  const task = (id: string, dueDate: string | null, dueComplete = false) => ({
    id,
    dueDate: dueDate ? at(dueDate) : null,
    dueComplete,
  })

  it('returns buckets in reading order and drops the empty ones', () => {
    const groups = groupTasks(
      [task('a', '2026-09-20T09:00:00'), task('b', '2026-09-27T09:00:00')],
      now,
    )
    expect(groups.map((group) => group.bucket)).toEqual(['overdue', 'today'])
  })

  it('sorts each bucket soonest first', () => {
    const groups = groupTasks(
      [task('late', '2026-10-05T09:00:00'), task('soon', '2026-10-04T09:00:00')],
      now,
    )
    expect(groups[0]!.tasks.map((t) => t.id)).toEqual(['soon', 'late'])
  })

  it('puts the longest-overdue task first, so it is hardest to ignore', () => {
    const groups = groupTasks(
      [task('recent', '2026-09-26T09:00:00'), task('ancient', '2026-01-01T09:00:00')],
      now,
    )
    expect(groups[0]!.tasks.map((t) => t.id)).toEqual(['ancient', 'recent'])
  })

  it('keeps every task exactly once', () => {
    const tasks = [
      task('a', '2026-09-20T09:00:00'),
      task('b', '2026-09-27T09:00:00'),
      task('c', '2026-10-01T09:00:00'),
      task('d', '2027-01-01T09:00:00'),
      task('e', null),
      task('f', '2026-09-01T09:00:00', true),
    ]
    const seen = groupTasks(tasks, now).flatMap((group) => group.tasks.map((t) => t.id))
    expect(seen.sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('returns nothing at all for an empty list', () => {
    expect(groupTasks([], now)).toEqual([])
  })
})
