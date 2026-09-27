import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, rlsSuiteEnabled, signInAs, signOutAll, type TestClient } from './client'

/**
 * The Phase 5 card RPCs, against the dev Supabase project.
 *
 * All three are `security definer`, so these assert the rules a client must never be trusted
 * with: who may be assigned, whose mentions are honoured, and that a copy cannot cross boards.
 * The suite works on a board it creates and deletes.
 */

const suite = rlsSuiteEnabled ? describe : describe.skip

suite('RLS: card detail RPCs', () => {
  let ada: TestClient
  let grace: TestClient
  let linus: TestClient
  let mallory: TestClient
  let boardId: string
  let listA: string
  let listB: string
  let cardId: string

  beforeAll(async () => {
    ;[ada, grace, linus, mallory] = await Promise.all([
      signInAs('ada'),
      signInAs('grace'),
      signInAs('linus'),
      signInAs('mallory'),
    ])

    const { data: team } = await ada.db.from('teams').select('id').eq('name', 'Product').single()
    if (!team) throw new Error('Seed data missing: run supabase/seed.sql against the dev project.')

    const board = await ada.db.rpc('create_board', {
      p_team_id: team.id,
      p_title: 'Card detail suite',
      p_position: 'zd0',
      p_with_default_lists: true,
    })
    boardId = board.data!.id

    const { data: lists } = await ada.db
      .from('lists')
      .select('id')
      .eq('board_id', boardId)
      .order('position')
    listA = lists![0]!.id
    listB = lists![1]!.id

    const card = await ada.db.rpc('create_card', {
      p_list_id: listA,
      p_title: 'Subject',
      p_position: 'a0',
    })
    cardId = card.data!.id
  }, 40_000)

  afterAll(async () => {
    await ada.db.from('boards').delete().eq('id', boardId)
    await signOutAll([ada, grace, linus, mallory].filter(Boolean))
  })

  describe('assign_card', () => {
    it('lets a member assign a teammate and notifies them', async () => {
      const { error } = await linus.db.rpc('assign_card', {
        p_card_id: cardId,
        p_user_id: grace.userId,
      })
      expect(error).toBeNull()

      const { data: rows } = await grace.db
        .from('card_assignees')
        .select('user_id')
        .eq('card_id', cardId)
      expect(rows?.map((row) => row.user_id)).toContain(grace.userId)

      const { data: notes } = await grace.db
        .from('notifications')
        .select('type')
        .eq('card_id', cardId)
        .eq('type', 'card_assigned')
      expect((notes ?? []).length).toBeGreaterThan(0)
    })

    it('refuses to assign someone outside the team', async () => {
      const { error } = await linus.db.rpc('assign_card', {
        p_card_id: cardId,
        p_user_id: mallory.userId,
      })
      expect(error?.code).toBe('42501')
    })

    it('is refused to an outsider and to a caller with no session', async () => {
      const outsider = await mallory.db.rpc('assign_card', {
        p_card_id: cardId,
        p_user_id: mallory.userId,
      })
      expect(outsider.error?.code).toBe('42501')

      const anon = await anonClient().rpc('assign_card', {
        p_card_id: cardId,
        p_user_id: ada.userId,
      })
      expect(anon.error).not.toBeNull()
    })

    it('lets anyone remove themselves', async () => {
      await linus.db.rpc('assign_card', { p_card_id: cardId, p_user_id: linus.userId })
      const { error } = await linus.db.rpc('assign_card', {
        p_card_id: cardId,
        p_user_id: linus.userId,
        p_assign: false,
      })
      expect(error).toBeNull()
    })
  })

  describe('add_card_comment', () => {
    it('is refused to an outsider', async () => {
      const { error } = await mallory.db.rpc('add_card_comment', {
        p_card_id: cardId,
        p_body: 'hello',
      })
      expect(error?.code).toBe('42501')
    })

    it('keeps a mention of a teammate', async () => {
      const { data, error } = await linus.db.rpc('add_card_comment', {
        p_card_id: cardId,
        p_body: 'ping @grace',
        p_mentions: [grace.userId],
      })
      expect(error).toBeNull()
      expect(data?.mentions).toEqual([grace.userId])
    })

    it('drops a mention of someone outside the team', async () => {
      // Otherwise a crafted request could notify — and so confirm the existence of — any account.
      const { data, error } = await linus.db.rpc('add_card_comment', {
        p_card_id: cardId,
        p_body: 'hello stranger',
        p_mentions: [mallory.userId],
      })
      expect(error).toBeNull()
      expect(data?.mentions).toEqual([])
    })
  })

  describe('copy_card', () => {
    it('copies within the board, unassigned', async () => {
      await ada.db.rpc('assign_card', { p_card_id: cardId, p_user_id: ada.userId })

      const { data, error } = await linus.db.rpc('copy_card', {
        p_card_id: cardId,
        p_list_id: listB,
        p_position: 'b0',
        p_title: 'A copy',
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({ title: 'A copy', list_id: listB, board_id: boardId })

      const { data: assignees } = await linus.db
        .from('card_assignees')
        .select('user_id')
        .eq('card_id', data!.id)
      expect(assignees).toEqual([])
    })

    it('refuses a destination on another board', async () => {
      const { data: team } = await ada.db.from('teams').select('id').eq('name', 'Product').single()
      const other = await ada.db.rpc('create_board', {
        p_team_id: team!.id,
        p_title: 'Copy target',
        p_position: 'zd9',
        p_with_default_lists: true,
      })
      const { data: otherLists } = await ada.db
        .from('lists')
        .select('id')
        .eq('board_id', other.data!.id)

      const { error } = await ada.db.rpc('copy_card', {
        p_card_id: cardId,
        p_list_id: otherLists![0]!.id,
        p_position: 'b0',
      })
      expect(error?.code).toBe('22023')

      await ada.db.from('boards').delete().eq('id', other.data!.id)
    })

    it('is refused to an outsider', async () => {
      const { error } = await mallory.db.rpc('copy_card', {
        p_card_id: cardId,
        p_list_id: listB,
        p_position: 'b1',
      })
      expect(error?.code).toBe('42501')
    })
  })

  describe('attachments', () => {
    const bucket = 'card-attachments'
    const file = () => new Blob(['hello'], { type: 'text/plain' })

    it('lets a member attach a file and refuses an outsider', async () => {
      const path = `${cardId}/${crypto.randomUUID()}.txt`
      const upload = await linus.db.storage
        .from(bucket)
        .upload(path, file(), { contentType: 'text/plain' })
      expect(upload.error).toBeNull()

      const outsider = await mallory.db.storage
        .from(bucket)
        .upload(`${cardId}/${crypto.randomUUID()}.txt`, file(), { contentType: 'text/plain' })
      expect(outsider.error).not.toBeNull()

      const seen = await mallory.db.storage.from(bucket).list(cardId)
      expect(seen.data ?? []).toHaveLength(0)

      await linus.db.storage.from(bucket).remove([path])
    })

    it('is not a public bucket', async () => {
      const path = `${cardId}/${crypto.randomUUID()}.txt`
      await linus.db.storage.from(bucket).upload(path, file(), { contentType: 'text/plain' })

      const { data } = linus.db.storage.from(bucket).getPublicUrl(path)
      const response = await fetch(data.publicUrl)
      expect(response.ok).toBe(false)

      await linus.db.storage.from(bucket).remove([path])
    })
  })
})
