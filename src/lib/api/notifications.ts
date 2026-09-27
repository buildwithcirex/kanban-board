import { requireSupabase } from '@/lib/supabase'
import type { Enums, Json } from '@/types/database.types'
import { toAppError, unwrap } from './errors'

export type NotificationType = Enums<'notification_type'>

export type InboxItem = {
  id: number
  type: NotificationType
  actorId: string | null
  teamId: string | null
  boardId: string | null
  cardId: string | null
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

type Row = {
  id: number
  type: NotificationType
  actor_id: string | null
  team_id: string | null
  board_id: string | null
  card_id: string | null
  payload: Json
  read_at: string | null
  created_at: string
  boards: { team_id: string } | null
}

/**
 * The inbox.
 *
 * No user filter is needed and none would help: the `notifications` policy is `user_id =
 * auth.uid()`, and unlike `card_assignees` there is no legitimate reason to see anyone else's —
 * so RLS alone is the right scope here.
 */
export async function listNotifications(
  { unreadOnly = false, limit = 50 }: { unreadOnly?: boolean; limit?: number } = {},
  signal?: AbortSignal,
): Promise<InboxItem[]> {
  let query = requireSupabase()
    .from('notifications')
    // The team comes from the board: the RPCs that raise card notifications know the board but
    // not the team, and a card link needs both.
    .select(
      'id, type, actor_id, team_id, board_id, card_id, payload, read_at, created_at, ' +
        'boards(team_id)',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (unreadOnly) query = query.is('read_at', null)
  if (signal) query = query.abortSignal(signal)

  const rows = unwrap(await query.returns<Row[]>())

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorId: row.actor_id,
    teamId: row.team_id ?? row.boards?.team_id ?? null,
    boardId: row.board_id,
    cardId: row.card_id,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    readAt: row.read_at,
    createdAt: row.created_at,
  }))
}

/** How many are unread. Counted by the server so a long inbox is not downloaded to count it. */
export async function countUnread(signal?: AbortSignal): Promise<number> {
  let query = requireSupabase()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (signal) query = query.abortSignal(signal)

  const { count, error } = await query
  if (error) throw toAppError(error)
  return count ?? 0
}

/** Marks some, or with no argument the whole inbox, as read. */
export async function markRead(ids?: number[]): Promise<void> {
  const { error } = await requireSupabase().rpc('mark_notifications_read', {
    ...(ids ? { p_ids: ids } : {}),
  })
  if (error) throw toAppError(error)
}

/** Where a notification takes you when it is opened, or null when there is nowhere to go. */
export function notificationHref(item: InboxItem): string | null {
  if (item.teamId && item.boardId && item.cardId) {
    return `/t/${item.teamId}/b/${item.boardId}/c/${item.cardId}`
  }
  if (item.boardId && item.cardId) return null
  if (item.teamId) return `/t/${item.teamId}`
  return null
}
