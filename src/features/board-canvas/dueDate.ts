/**
 * Due-date badges, in the vocabulary Trello uses: what matters is how close the date is, not the
 * date itself, so a card can be read at a glance.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type DueTone = 'complete' | 'overdue' | 'soon' | 'upcoming'

/** Which bucket a due date falls into, relative to `now`. */
export function dueTone(
  dueDate: string | null,
  dueComplete: boolean,
  now: Date = new Date(),
): DueTone | null {
  if (!dueDate) return null
  if (dueComplete) return 'complete'

  const due = new Date(dueDate).getTime()
  if (Number.isNaN(due)) return null

  const delta = due - now.getTime()
  if (delta < 0) return 'overdue'
  // "Soon" is the next 24 hours, matching the due-soon reminder in the plan.
  if (delta <= DAY) return 'soon'
  return 'upcoming'
}

/** A short label such as "2h left", "3d overdue" or "12 Mar". */
export function dueDateLabel(
  dueDate: string | null,
  dueComplete: boolean,
  now: Date = new Date(),
): string | null {
  const tone = dueTone(dueDate, dueComplete, now)
  if (!tone || !dueDate) return null

  const due = new Date(dueDate)
  if (tone === 'complete') return 'Done'

  const delta = due.getTime() - now.getTime()
  const magnitude = Math.abs(delta)

  if (magnitude < HOUR) {
    const minutes = Math.max(1, Math.round(magnitude / MINUTE))
    return delta < 0 ? `${minutes}m overdue` : `${minutes}m left`
  }
  if (magnitude < DAY) {
    const hours = Math.round(magnitude / HOUR)
    return delta < 0 ? `${hours}h overdue` : `${hours}h left`
  }
  if (magnitude < 7 * DAY) {
    const days = Math.round(magnitude / DAY)
    return delta < 0 ? `${days}d overdue` : `${days}d left`
  }

  return due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Tailwind classes for the badge. Colour is never the only signal — the label says it too. */
export function dueDateTone(
  dueDate: string | null,
  dueComplete: boolean,
  now: Date = new Date(),
): string {
  switch (dueTone(dueDate, dueComplete, now)) {
    case 'complete':
      return 'bg-success/15 text-success'
    case 'overdue':
      return 'bg-danger/15 text-danger'
    case 'soon':
      return 'bg-warning/20 text-warning'
    default:
      return 'bg-surface-sunken text-fg-muted'
  }
}
