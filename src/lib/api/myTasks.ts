import { requireSupabase } from '@/lib/supabase'
import type { Enums } from '@/types/database.types'
import { unwrap } from './errors'

export type MyTask = {
  cardId: string
  title: string
  dueDate: string | null
  dueComplete: boolean
  priority: Enums<'card_priority'>
  boardId: string
  boardTitle: string
  teamId: string
  listTitle: string
}

type Row = {
  card_id: string
  cards: {
    id: string
    title: string
    due_date: string | null
    due_complete: boolean
    priority: Enums<'card_priority'>
    archived: boolean
    deleted_at: string | null
    lists: {
      title: string
      archived: boolean
      boards: { id: string; title: string; team_id: string; archived: boolean } | null
    } | null
  } | null
}

/**
 * Every card assigned to `userId`, across every team.
 *
 * Two things are load bearing here:
 *
 * 1. **The `user_id` filter.** RLS on `card_assignees` returns every assignee of a card you can
 *    see — that is what makes the board's avatars work — so "mine" has to be asked for, not
 *    assumed. Without it this returns a teammate's work as your own.
 * 2. **Archived parents are excluded in JavaScript, not SQL.** A card in an archived list keeps
 *    `archived = false`, so it disappears from the board but would still look like live work
 *    here. PostgREST cannot filter the parent of an embedded row, so the join is filtered after
 *    it arrives.
 *
 * ⚠️ The board is reached *through the list*. `cards.board_id` is half of a composite foreign key
 * to `lists(id, board_id)`, not a foreign key to `boards`, so PostgREST has no `cards → boards`
 * relationship to follow and asking for one fails with PGRST200.
 */
export async function listMyTasks(userId: string, signal?: AbortSignal): Promise<MyTask[]> {
  let query = requireSupabase()
    .from('card_assignees')
    .select(
      'card_id, cards(id, title, due_date, due_complete, priority, archived, deleted_at, ' +
        'lists(title, archived, boards(id, title, team_id, archived)))',
    )
    .eq('user_id', userId)
  if (signal) query = query.abortSignal(signal)

  const rows = unwrap(await query.returns<Row[]>())

  return rows
    .flatMap((row) => {
      const card = row.cards
      if (!card || card.archived || card.deleted_at !== null) return []
      if (!card.lists || card.lists.archived) return []
      const board = card.lists.boards
      if (!board || board.archived) return []

      return [
        {
          cardId: card.id,
          title: card.title,
          dueDate: card.due_date,
          dueComplete: card.due_complete,
          priority: card.priority,
          boardId: board.id,
          boardTitle: board.title,
          teamId: board.team_id,
          listTitle: card.lists.title,
        },
      ]
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

export type WorkloadEntry = {
  userId: string
  total: number
  overdue: number
  dueSoon: number
}

type WorkloadRow = {
  user_id: string
  cards: {
    due_date: string | null
    due_complete: boolean
    archived: boolean
    deleted_at: string | null
    lists: { archived: boolean; boards: { team_id: string; archived: boolean } | null } | null
  } | null
}

/**
 * How much live work each member of a team is carrying.
 *
 * Deliberately not filtered by user: this is the team view, and RLS already limits it to boards
 * the caller can see — a private board they are not on contributes nothing, which is correct.
 */
export async function getTeamWorkload(
  teamId: string,
  now: Date = new Date(),
  signal?: AbortSignal,
): Promise<WorkloadEntry[]> {
  let query = requireSupabase()
    .from('card_assignees')
    .select(
      'user_id, cards(due_date, due_complete, archived, deleted_at, ' +
        'lists(archived, boards(team_id, archived)))',
    )
  if (signal) query = query.abortSignal(signal)

  const rows = unwrap(await query.returns<WorkloadRow[]>())
  const soonLimit = now.getTime() + 24 * 60 * 60 * 1000
  const byUser = new Map<string, WorkloadEntry>()

  for (const row of rows) {
    const card = row.cards
    if (!card || card.archived || card.deleted_at !== null) continue
    if (!card.lists || card.lists.archived) continue
    const board = card.lists.boards
    if (!board || board.archived || board.team_id !== teamId) continue

    const entry = byUser.get(row.user_id) ?? {
      userId: row.user_id,
      total: 0,
      overdue: 0,
      dueSoon: 0,
    }
    entry.total += 1

    if (card.due_date && !card.due_complete) {
      const due = new Date(card.due_date).getTime()
      if (due < now.getTime()) entry.overdue += 1
      else if (due <= soonLimit) entry.dueSoon += 1
    }

    byUser.set(row.user_id, entry)
  }

  return [...byUser.values()].sort((a, b) => b.total - a.total)
}
