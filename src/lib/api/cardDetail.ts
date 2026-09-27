import { requireSupabase } from '@/lib/supabase'
import type { Enums, Tables, TablesUpdate } from '@/types/database.types'
import { toAppError, unwrap, withMessages } from './errors'

export type Card = Tables<'cards'>
export type Label = Tables<'labels'>
export type Checklist = Tables<'checklists'>
export type ChecklistItem = Tables<'checklist_items'>
export type Attachment = Tables<'attachments'>
export type CardPriority = Enums<'card_priority'>

export type CardComment = {
  id: string
  body: string
  mentions: string[]
  authorId: string | null
  createdAt: string
}

export type CardActivity = {
  id: number
  type: string
  actorId: string | null
  createdAt: string
  payload: Record<string, unknown>
}

export type CardDetail = {
  card: Card
  assigneeIds: string[]
  labelIds: string[]
  checklists: (Checklist & { items: ChecklistItem[] })[]
  comments: CardComment[]
  attachments: Attachment[]
  activity: CardActivity[]
}

export const ATTACHMENT_BUCKET = 'card-attachments'
/** Matches the bucket's own limit, so the error arrives before the bytes do. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

/**
 * Everything the card sheet shows, in one round trip.
 *
 * Six separate queries would mean six spinners and a visible cascade on a phone; PostgREST can
 * embed the lot, and RLS scopes each embedded table exactly as it would on its own.
 */
export async function getCardDetail(cardId: string, signal?: AbortSignal): Promise<CardDetail> {
  const supabase = requireSupabase()

  let cardQuery = supabase
    .from('cards')
    .select(
      '*, card_assignees(user_id), card_labels(label_id), ' +
        'checklists(*, checklist_items(*)), ' +
        'comments(id, body, mentions, author_id, created_at), ' +
        'attachments(*)',
    )
    .eq('id', cardId)
  if (signal) cardQuery = cardQuery.abortSignal(signal)

  type Row = Card & {
    card_assignees: { user_id: string }[] | null
    card_labels: { label_id: string }[] | null
    checklists: (Checklist & { checklist_items: ChecklistItem[] | null })[] | null
    comments:
      | {
          id: string
          body: string
          mentions: string[]
          author_id: string | null
          created_at: string
        }[]
      | null
    attachments: Attachment[] | null
  }

  // The embedded selects are beyond what the generated types can infer, so the shape is
  // declared above and asserted here rather than left as `any` throughout.
  const row = unwrap(await cardQuery.single()) as unknown as Row

  // The feed is a separate table with its own policy, and is capped: a busy card should not drag
  // the whole sheet down with it.
  let activityQuery = supabase
    .from('activity')
    .select('id, type, actor_id, created_at, payload')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (signal) activityQuery = activityQuery.abortSignal(signal)
  const activity = unwrap(await activityQuery)

  const { card_assignees, card_labels, checklists, comments, attachments, ...card } = row

  // Positions are fractional-index strings compared as bytes, matching `collate "C"`.
  const byPosition = (a: { position: string }, b: { position: string }) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : 0

  return {
    card,
    assigneeIds: (card_assignees ?? []).map((a) => a.user_id),
    labelIds: (card_labels ?? []).map((l) => l.label_id),
    checklists: [...(checklists ?? [])].sort(byPosition).map((list) => {
      const { checklist_items, ...rest } = list
      return { ...rest, items: [...(checklist_items ?? [])].sort(byPosition) }
    }),
    comments: (comments ?? [])
      .map((comment) => ({
        id: comment.id,
        body: comment.body,
        mentions: comment.mentions ?? [],
        authorId: comment.author_id,
        createdAt: comment.created_at,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    attachments: (attachments ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    activity: activity.map((entry) => ({
      id: entry.id,
      type: entry.type,
      actorId: entry.actor_id,
      createdAt: entry.created_at,
      payload: (entry.payload ?? {}) as Record<string, unknown>,
    })),
  }
}

export type CardFields = {
  title?: string
  description?: string | null
  dueDate?: string | null
  startDate?: string | null
  dueComplete?: boolean
  priority?: CardPriority
  archived?: boolean
}

/** Description, dates and priority are single-row writes, so they go through the table policy. */
export async function updateCardFields(cardId: string, fields: CardFields): Promise<Card> {
  const update: TablesUpdate<'cards'> = {}
  if (fields.title !== undefined) update.title = fields.title.trim()
  if (fields.description !== undefined) update.description = fields.description?.trim() || null
  if (fields.dueDate !== undefined) update.due_date = fields.dueDate
  if (fields.startDate !== undefined) update.start_date = fields.startDate
  if (fields.dueComplete !== undefined) update.due_complete = fields.dueComplete
  if (fields.priority !== undefined) update.priority = fields.priority
  if (fields.archived !== undefined) update.archived = fields.archived

  const result = await requireSupabase()
    .from('cards')
    .update(update)
    .eq('id', cardId)
    .select()
    .single()

  if (result.error) {
    throw withMessages(result.error, {
      'not-found': "That card no longer exists, or the board is archived so it can't be changed.",
      invalid: 'One of those values is not valid.',
    })
  }
  return result.data
}

export async function assignCard(cardId: string, userId: string, assign: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('assign_card', {
    p_card_id: cardId,
    p_user_id: userId,
    p_assign: assign,
  })
  if (error) {
    throw withMessages(error, {
      forbidden: 'Only people in this team can be assigned.',
      'not-found': 'That card no longer exists.',
    })
  }
}

export async function addComment(cardId: string, body: string, mentions: string[]): Promise<void> {
  const { error } = await requireSupabase().rpc('add_card_comment', {
    p_card_id: cardId,
    p_body: body.trim(),
    p_mentions: mentions,
  })
  if (error) {
    throw withMessages(error, {
      forbidden: "You can't comment on this card.",
      invalid: 'That comment is too long.',
    })
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  const result = await requireSupabase().from('comments').delete().eq('id', commentId).select('id')
  if (result.error) throw toAppError(result.error)
  if ((result.data ?? []).length === 0) {
    throw withMessages({ code: '42501' }, { forbidden: "You can't delete that comment." })
  }
}

export async function copyCard(input: {
  cardId: string
  listId: string
  position: string
  title?: string
}): Promise<Card> {
  const { data, error } = await requireSupabase().rpc('copy_card', {
    p_card_id: input.cardId,
    p_list_id: input.listId,
    p_position: input.position,
    ...(input.title ? { p_title: input.title } : {}),
  })
  if (error) {
    throw withMessages(error, {
      forbidden: "You can't copy this card.",
      invalid: 'A card can only be copied within its own board.',
    })
  }
  return data
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export async function listBoardLabels(boardId: string, signal?: AbortSignal): Promise<Label[]> {
  let query = requireSupabase().from('labels').select('*').eq('board_id', boardId).order('position')
  if (signal) query = query.abortSignal(signal)
  return unwrap(await query)
}

export async function createLabel(input: {
  boardId: string
  name: string
  color: string
  position: string
}): Promise<Label> {
  const result = await requireSupabase()
    .from('labels')
    .insert({
      board_id: input.boardId,
      name: input.name.trim(),
      color: input.color,
      position: input.position,
    })
    .select()
    .single()
  if (result.error) {
    throw withMessages(result.error, {
      conflict: 'This board already has a label with that name.',
      forbidden: "This board is archived, so it can't be changed.",
    })
  }
  return result.data
}

export async function setCardLabel(input: {
  cardId: string
  labelId: string
  boardId: string
  on: boolean
}): Promise<void> {
  const supabase = requireSupabase()
  const { error } = input.on
    ? await supabase
        .from('card_labels')
        .insert({ card_id: input.cardId, label_id: input.labelId, board_id: input.boardId })
    : await supabase
        .from('card_labels')
        .delete()
        .eq('card_id', input.cardId)
        .eq('label_id', input.labelId)
  // Toggling the same label twice quickly is harmless, not an error worth showing.
  if (error && toAppError(error).kind !== 'conflict') {
    throw withMessages(error, { forbidden: "You can't change labels on this card." })
  }
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export async function createChecklist(input: {
  cardId: string
  title: string
  position: string
}): Promise<Checklist> {
  return unwrap(
    await requireSupabase()
      .from('checklists')
      .insert({ card_id: input.cardId, title: input.title.trim(), position: input.position })
      .select()
      .single(),
  )
}

export async function deleteChecklist(checklistId: string): Promise<void> {
  const { error } = await requireSupabase().from('checklists').delete().eq('id', checklistId)
  if (error) throw toAppError(error)
}

export async function createChecklistItem(input: {
  checklistId: string
  text: string
  position: string
}): Promise<ChecklistItem> {
  return unwrap(
    await requireSupabase()
      .from('checklist_items')
      .insert({
        checklist_id: input.checklistId,
        text: input.text.trim(),
        position: input.position,
      })
      .select()
      .single(),
  )
}

export async function setChecklistItemDone(itemId: string, done: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from('checklist_items')
    .update({ done })
    .eq('id', itemId)
  if (error) throw withMessages(error, { forbidden: "You can't change this checklist." })
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  const { error } = await requireSupabase().from('checklist_items').delete().eq('id', itemId)
  if (error) throw toAppError(error)
}

// ---------------------------------------------------------------------------
// Attachments (private bucket, signed URLs)
// ---------------------------------------------------------------------------

export async function uploadAttachment(cardId: string, file: File): Promise<Attachment> {
  const supabase = requireSupabase()
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'file'
  const path = `${cardId}/${crypto.randomUUID()}-${safeName}`

  const upload = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (upload.error) {
    throw withMessages(upload.error, {
      forbidden: "You can't add files to this card.",
      invalid: 'That file is too large.',
    })
  }

  const row = await supabase
    .from('attachments')
    .insert({
      card_id: cardId,
      uploader_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      name: file.name.slice(0, 255),
      mime: file.type || 'application/octet-stream',
      size: file.size,
      storage_path: path,
    })
    .select()
    .single()

  if (row.error) {
    // Don't leave the object behind if the row it belongs to could not be written.
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path])
    throw toAppError(row.error)
  }
  return row.data
}

export async function signAttachmentUrl(path: string, download = false): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 3600, download ? { download: true } : undefined)
  if (error || !data) throw toAppError(error)
  return data.signedUrl
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  const supabase = requireSupabase()
  const result = await supabase.from('attachments').delete().eq('id', attachment.id).select('id')
  if (result.error) throw toAppError(result.error)
  if ((result.data ?? []).length === 0) {
    throw withMessages({ code: '42501' }, { forbidden: "You can't remove that file." })
  }
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storage_path])
}
