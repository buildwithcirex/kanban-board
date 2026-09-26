import { requireSupabase } from '@/lib/supabase'
import type { Enums, Tables, TablesUpdate } from '@/types/database.types'
import { AppError, toAppError, unwrap, withMessages } from './errors'

export type Board = Tables<'boards'>
export type BoardVisibility = Enums<'board_visibility'>

/**
 * How `boards.background` is stored. Keeping both kinds in one text column avoids a migration
 * every time we add a style, at the cost of this prefix convention:
 *
 *   `color:#4b7bec`                     a flat colour
 *   `image:<board id>/<file>`           an object in the private `board-backgrounds` bucket
 *
 * Anything unrecognised (including null) renders as the default surface.
 */
export type Background =
  { kind: 'none' } | { kind: 'color'; color: string } | { kind: 'image'; path: string }

const HEX = /^#[0-9a-fA-F]{6}$/

export function parseBackground(value: string | null): Background {
  if (!value) return { kind: 'none' }
  if (value.startsWith('color:')) {
    const color = value.slice('color:'.length)
    return HEX.test(color) ? { kind: 'color', color } : { kind: 'none' }
  }
  if (value.startsWith('image:')) {
    const path = value.slice('image:'.length)
    return path ? { kind: 'image', path } : { kind: 'none' }
  }
  return { kind: 'none' }
}

export function serializeBackground(background: Background): string | null {
  switch (background.kind) {
    case 'color':
      return `color:${background.color}`
    case 'image':
      return `image:${background.path}`
    case 'none':
      return null
  }
}

export const BACKGROUND_BUCKET = 'board-backgrounds'

/**
 * Boards of one team. Archived boards are excluded unless asked for, which is what makes the
 * archive view a separate query rather than a client-side filter of everything.
 */
export async function listTeamBoards(
  teamId: string,
  { archived = false }: { archived?: boolean } = {},
  signal?: AbortSignal,
): Promise<Board[]> {
  let query = requireSupabase()
    .from('boards')
    .select('*')
    .eq('team_id', teamId)
    .eq('archived', archived)
    .order('position')
  if (signal) query = query.abortSignal(signal)
  return unwrap(await query)
}

/** Every board the caller can see, across all their teams. RLS does the scoping. */
export async function listAllBoards(signal?: AbortSignal): Promise<Board[]> {
  let query = requireSupabase().from('boards').select('*').eq('archived', false).order('position')
  if (signal) query = query.abortSignal(signal)
  return unwrap(await query)
}

export async function getBoard(boardId: string, signal?: AbortSignal): Promise<Board> {
  let query = requireSupabase().from('boards').select('*').eq('id', boardId)
  if (signal) query = query.abortSignal(signal)
  return unwrap(await query.single())
}

export type NewBoard = {
  teamId: string
  title: string
  position: string
  visibility?: BoardVisibility
  background?: string | null
  withDefaultLists?: boolean
}

/**
 * Creates a board with its starting lists.
 *
 * Goes through the RPC rather than an insert for two reasons: the board, its lists and (for a
 * private board) the creator's membership must land together, and `insert ... select()` cannot
 * read the new row back — RETURNING re-checks the SELECT policy, which for a private board needs
 * a `board_members` row that does not exist yet.
 */
export async function createBoard(input: NewBoard): Promise<Board> {
  const { data, error } = await requireSupabase().rpc('create_board', {
    p_team_id: input.teamId,
    p_title: input.title.trim(),
    p_position: input.position,
    ...(input.visibility ? { p_visibility: input.visibility } : {}),
    ...(input.background ? { p_background: input.background } : {}),
    ...(input.withDefaultLists === undefined
      ? {}
      : { p_with_default_lists: input.withDefaultLists }),
  })
  if (error) {
    throw withMessages(error, {
      forbidden: 'Only members of this team can create boards.',
      invalid: 'That board title is not valid.',
    })
  }
  return data
}

export type BoardPatch = {
  title?: string
  background?: string | null
  archived?: boolean
  position?: string
}

/** Rename, restyle, archive or reorder. Visibility has its own call — see below. */
export async function updateBoard(boardId: string, patch: BoardPatch): Promise<Board> {
  const update: TablesUpdate<'boards'> = {}
  if (patch.title !== undefined) update.title = patch.title.trim()
  if (patch.background !== undefined) update.background = patch.background
  if (patch.archived !== undefined) update.archived = patch.archived
  if (patch.position !== undefined) update.position = patch.position

  const result = await requireSupabase()
    .from('boards')
    .update(update)
    .eq('id', boardId)
    .select()
    .single()

  if (result.error) {
    throw withMessages(result.error, {
      'not-found': "That board no longer exists, or you can't change it.",
    })
  }
  return result.data
}

/**
 * Changing visibility is its own RPC: turning a board private also has to add the caller to its
 * member list, or the board would vanish for everyone the moment it changed.
 */
export async function setBoardVisibility(
  boardId: string,
  visibility: BoardVisibility,
): Promise<Board> {
  const { data, error } = await requireSupabase().rpc('set_board_visibility', {
    p_board_id: boardId,
    p_visibility: visibility,
  })
  if (error) {
    throw withMessages(error, {
      forbidden: 'You do not have access to this board.',
      'not-found': 'That board no longer exists.',
    })
  }
  return data
}

/** Permanently deletes a board and everything on it. RLS restricts this to team admins. */
export async function deleteBoard(boardId: string): Promise<void> {
  const result = await requireSupabase().from('boards').delete().eq('id', boardId).select('id')
  if (result.error) throw toAppError(result.error)
  if ((result.data ?? []).length === 0) {
    throw new AppError('forbidden', 'Only the team owner or an admin can delete a board.')
  }
}

// ---------------------------------------------------------------------------
// Private board membership
// ---------------------------------------------------------------------------

export type BoardMember = {
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  color: string
}

type BoardMemberRow = {
  user_id: string
  profiles: Pick<Tables<'profiles'>, 'name' | 'email' | 'avatar_url' | 'color'> | null
}

export async function listBoardMembers(
  boardId: string,
  signal?: AbortSignal,
): Promise<BoardMember[]> {
  let query = requireSupabase()
    .from('board_members')
    .select('user_id, profiles(name, email, avatar_url, color)')
    .eq('board_id', boardId)
  if (signal) query = query.abortSignal(signal)

  const rows = unwrap(await query.returns<BoardMemberRow[]>())
  return rows
    .map((row) => ({
      userId: row.user_id,
      name: row.profiles?.name ?? 'Unknown member',
      email: row.profiles?.email ?? '',
      avatarUrl: row.profiles?.avatar_url ?? null,
      color: row.profiles?.color ?? '#4b7bec',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function addBoardMember(boardId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('board_members')
    .insert({ board_id: boardId, user_id: userId })
  if (error) {
    throw withMessages(error, {
      forbidden: 'They must be in this team before they can join the board.',
      conflict: 'They are already on this board.',
    })
  }
}

export async function removeBoardMember(boardId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)
  if (error) throw toAppError(error)
}

// ---------------------------------------------------------------------------
// Background images (private bucket, signed URLs)
// ---------------------------------------------------------------------------

/** Uploads a background and returns its storage path. The board id is the folder, per the policies. */
export async function uploadBoardBackground(boardId: string, file: File): Promise<string> {
  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${boardId}/${crypto.randomUUID()}.${extension}`

  const { error } = await requireSupabase()
    .storage.from(BACKGROUND_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (error) {
    throw withMessages(error, {
      forbidden: "You can't change this board's background.",
      invalid: 'That file is too large, or not an image we support.',
    })
  }
  return path
}

/**
 * A short-lived URL for a background. The bucket is private, so there is no permanent link —
 * every viewer has to be authorised at the moment they ask.
 */
export async function signBackgroundUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from(BACKGROUND_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error || !data) throw toAppError(error)
  return data.signedUrl
}

export async function deleteBoardBackground(path: string): Promise<void> {
  const { error } = await requireSupabase().storage.from(BACKGROUND_BUCKET).remove([path])
  if (error) throw toAppError(error)
}
