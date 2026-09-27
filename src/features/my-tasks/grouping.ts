/**
 * How My Tasks is grouped.
 *
 * Buckets are relative to the reader's own day, not to UTC: "today" has to mean today where the
 * person is sitting, so every boundary is computed from a local `Date`. Everything here is pure
 * and takes `now`, so the buckets can be tested without waiting for midnight.
 */

export type TaskBucket = 'overdue' | 'today' | 'week' | 'later' | 'someday'

export const bucketOrder: TaskBucket[] = ['overdue', 'today', 'week', 'later', 'someday']

export const bucketLabels: Record<TaskBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'This week',
  later: 'Later',
  someday: 'No due date',
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/**
 * Which bucket a due date falls into.
 *
 * A card with no due date is "someday" rather than being dropped: it is still assigned work, and
 * hiding it would make My Tasks quietly incomplete. A completed due date is treated the same
 * way — it is no longer waiting on a date.
 */
export function bucketFor(
  dueDate: string | null,
  dueComplete: boolean,
  now: Date = new Date(),
): TaskBucket {
  if (!dueDate || dueComplete) return 'someday'

  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return 'someday'

  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  if (due < todayStart) return 'overdue'
  if (due < tomorrowStart) return 'today'

  // "This week" is the next seven days, which is what a person means by it far more often than
  // "until Sunday".
  const weekEnd = new Date(todayStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  if (due < weekEnd) return 'week'

  return 'later'
}

export type Groupable = {
  dueDate: string | null
  dueComplete: boolean
}

export type Group<T> = { bucket: TaskBucket; label: string; tasks: T[] }

/**
 * Buckets tasks and sorts each one.
 *
 * Dated buckets run soonest first — the next thing to do is at the top — and overdue runs oldest
 * first, so the thing that has been waiting longest is hardest to ignore.
 */
export function groupTasks<T extends Groupable>(
  tasks: readonly T[],
  now: Date = new Date(),
): Group<T>[] {
  const byBucket = new Map<TaskBucket, T[]>()
  for (const bucket of bucketOrder) byBucket.set(bucket, [])

  for (const task of tasks) {
    byBucket.get(bucketFor(task.dueDate, task.dueComplete, now))!.push(task)
  }

  return bucketOrder
    .map((bucket) => {
      const tasks = byBucket.get(bucket)!
      tasks.sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0
        return a.dueDate.localeCompare(b.dueDate)
      })
      return { bucket, label: bucketLabels[bucket], tasks }
    })
    .filter((group) => group.tasks.length > 0)
}
