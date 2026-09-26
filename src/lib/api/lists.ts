import { requireSupabase } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/database.types'
import { unwrap, withMessages } from './errors'

export type List = Tables<'lists'>

/**
 * Lists of one board.
 *
 * Unlike boards, a plain insert works here: the SELECT policy reads the *board*, which already
 * exists, so RETURNING has something to check against.
 */
export async function listBoardLists(
  boardId: string,
  { archived = false }: { archived?: boolean } = {},
  signal?: AbortSignal,
): Promise<List[]> {
  let query = requireSupabase()
    .from('lists')
    .select('*')
    .eq('board_id', boardId)
    .eq('archived', archived)
    .order('position')
  if (signal) query = query.abortSignal(signal)
  return unwrap(await query)
}

export type NewList = {
  boardId: string
  title: string
  position: string
  wipLimit?: number | null
}

export async function createList(input: NewList): Promise<List> {
  const result = await requireSupabase()
    .from('lists')
    .insert({
      board_id: input.boardId,
      title: input.title.trim(),
      position: input.position,
      wip_limit: input.wipLimit ?? null,
    })
    .select()
    .single()

  if (result.error) {
    throw withMessages(result.error, {
      forbidden: "This board is archived, so it can't be changed.",
      invalid: 'That list title is not valid.',
    })
  }
  return result.data
}

export type ListPatch = {
  title?: string
  position?: string
  archived?: boolean
  wipLimit?: number | null
}

export async function updateList(listId: string, patch: ListPatch): Promise<List> {
  const update: TablesUpdate<'lists'> = {}
  if (patch.title !== undefined) update.title = patch.title.trim()
  if (patch.position !== undefined) update.position = patch.position
  if (patch.archived !== undefined) update.archived = patch.archived
  if (patch.wipLimit !== undefined) update.wip_limit = patch.wipLimit

  const result = await requireSupabase()
    .from('lists')
    .update(update)
    .eq('id', listId)
    .select()
    .single()

  if (result.error) {
    throw withMessages(result.error, {
      'not-found': "That list no longer exists, or the board is archived so it can't be changed.",
      invalid: 'That list title or WIP limit is not valid.',
    })
  }
  return result.data
}

/** Permanently deletes a list and its cards. Archiving is the reversible option. */
export async function deleteList(listId: string): Promise<void> {
  const result = await requireSupabase().from('lists').delete().eq('id', listId).select('id')
  if (result.error) throw withMessages(result.error, {})
  if ((result.data ?? []).length === 0) {
    throw withMessages({ code: '42501' }, { forbidden: "You can't delete this list." })
  }
}
