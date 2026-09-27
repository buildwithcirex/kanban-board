import { requireSupabase } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/database.types'
import { unwrap, withMessages } from './errors'

export type Card = Tables<'cards'>

/** A card as the board renders it: the row plus the few things shown on its front. */
export type BoardCard = Card & {
  assigneeIds: string[]
  labels: { id: string; name: string; color: string }[]
}

type CardRow = Card & {
  card_assignees: { user_id: string }[] | null
  card_labels: { labels: { id: string; name: string; color: string } | null }[] | null
}

/**
 * Every card on a board, with what the card front needs.
 *
 * One query for the whole board rather than one per list: lists are re-ordered and cards move
 * between them constantly, and a per-list query would mean a waterfall on every board open.
 * Soft-deleted cards are excluded here; `archived` is kept so the board can dim or hide them.
 */
export async function listBoardCards(
  boardId: string,
  { archived = false }: { archived?: boolean } = {},
  signal?: AbortSignal,
): Promise<BoardCard[]> {
  let query = requireSupabase()
    .from('cards')
    .select('*, card_assignees(user_id), card_labels(labels(id, name, color))')
    .eq('board_id', boardId)
    .eq('archived', archived)
    .is('deleted_at', null)
    .order('position')
  if (signal) query = query.abortSignal(signal)

  const rows = unwrap(await query.returns<CardRow[]>())

  return rows.map((row) => {
    const { card_assignees, card_labels, ...card } = row
    return {
      ...card,
      assigneeIds: (card_assignees ?? []).map((assignee) => assignee.user_id),
      labels: (card_labels ?? [])
        .map((link) => link.labels)
        .filter((label): label is NonNullable<typeof label> => label !== null),
    }
  })
}

export type NewCard = {
  listId: string
  title: string
  position: string
}

/**
 * Adds a card.
 *
 * A plain insert would work — a card's SELECT policy reads the *board*, which already exists —
 * but the RPC keeps the board id server-side (taken from the list, never from the client) and
 * writes the activity entry in the same transaction.
 */
export async function createCard(input: NewCard): Promise<Card> {
  const { data, error } = await requireSupabase().rpc('create_card', {
    p_list_id: input.listId,
    p_title: input.title.trim(),
    p_position: input.position,
  })
  if (error) {
    throw withMessages(error, {
      forbidden: "This board is archived, so it can't be changed.",
      'not-found': 'That list no longer exists.',
      invalid: 'That card title is not valid.',
    })
  }
  return data
}

export type CardMove = {
  cardId: string
  listId: string
  position: string
}

/**
 * Moves a card to a list and position.
 *
 * The RPC refuses a destination list on another board, so a tampered request cannot fling a card
 * somewhere the caller cannot see. Reordering within a list goes through here too.
 */
export async function moveCard(move: CardMove): Promise<Card> {
  const { data, error } = await requireSupabase().rpc('move_card', {
    p_card_id: move.cardId,
    p_list_id: move.listId,
    p_position: move.position,
  })
  if (error) {
    throw withMessages(error, {
      forbidden: "You can't move this card.",
      'not-found': 'That card or list no longer exists.',
      invalid: 'A card cannot move to a different board.',
    })
  }
  return data
}

export type CardPatch = {
  title?: string
  archived?: boolean
}

export async function updateCard(cardId: string, patch: CardPatch): Promise<Card> {
  const update: TablesUpdate<'cards'> = {}
  if (patch.title !== undefined) update.title = patch.title.trim()
  if (patch.archived !== undefined) update.archived = patch.archived

  const result = await requireSupabase()
    .from('cards')
    .update(update)
    .eq('id', cardId)
    .select()
    .single()

  if (result.error) {
    throw withMessages(result.error, {
      'not-found': "That card no longer exists, or the board is archived so it can't be changed.",
      invalid: 'That card title is not valid.',
    })
  }
  return result.data
}

/** Permanently deletes a card. Archiving is the reversible option. */
export async function deleteCard(cardId: string): Promise<void> {
  const result = await requireSupabase().from('cards').delete().eq('id', cardId).select('id')
  if (result.error) throw withMessages(result.error, {})
  if ((result.data ?? []).length === 0) {
    throw withMessages({ code: '42501' }, { forbidden: "You can't delete this card." })
  }
}
