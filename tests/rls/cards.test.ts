import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, rlsSuiteEnabled, signInAs, signOutAll, type TestClient } from './client'

/**
 * The Phase 4 card RPCs, against the dev Supabase project.
 *
 * `create_card` and `move_card` are `security definer`, so RLS does not guard them — they check
 * the caller themselves. These assert the two rules a client must never be trusted with: who may
 * touch a board, and that a card cannot leave the board it belongs to.
 */

const suite = rlsSuiteEnabled ? describe : describe.skip

suite('RLS: card RPCs', () => {
  let ada: TestClient
  let linus: TestClient
  let mallory: TestClient
  let boardId: string
  let otherBoardId: string
  let listA: string
  let listB: string
  let otherList: string
  const scratchCards: string[] = []

  beforeAll(async () => {
    ;[ada, linus, mallory] = await Promise.all([
      signInAs('ada'),
      signInAs('linus'),
      signInAs('mallory'),
    ])

    const { data: team } = await ada.db.from('teams').select('id').eq('name', 'Product').single()
    if (!team) throw new Error('Seed data missing: run supabase/seed.sql against the dev project.')

    const board = await ada.db.rpc('create_board', {
      p_team_id: team.id,
      p_title: 'Card RPC suite',
      p_position: 'zc0',
      p_with_default_lists: true,
    })
    boardId = board.data!.id

    const other = await ada.db.rpc('create_board', {
      p_team_id: team.id,
      p_title: 'Card RPC suite other',
      p_position: 'zc1',
      p_with_default_lists: true,
    })
    otherBoardId = other.data!.id

    const { data: lists } = await ada.db
      .from('lists')
      .select('id')
      .eq('board_id', boardId)
      .order('position')
    listA = lists![0]!.id
    listB = lists![1]!.id

    const { data: otherLists } = await ada.db
      .from('lists')
      .select('id')
      .eq('board_id', otherBoardId)
    otherList = otherLists![0]!.id
  }, 40_000)

  afterEach(async () => {
    await Promise.all(scratchCards.map((id) => ada.db.from('cards').delete().eq('id', id)))
    scratchCards.length = 0
  })

  afterAll(async () => {
    await ada.db.from('boards').delete().eq('id', boardId)
    await ada.db.from('boards').delete().eq('id', otherBoardId)
    await signOutAll([ada, linus, mallory].filter(Boolean))
  })

  async function makeCard(client: TestClient, title: string, listId = listA) {
    const { data, error } = await client.db.rpc('create_card', {
      p_list_id: listId,
      p_title: title,
      p_position: `m${scratchCards.length}`,
    })
    expect(error).toBeNull()
    scratchCards.push(data!.id)
    return data!
  }

  describe('create_card', () => {
    it('lets a team member add a card and takes the board from the list', async () => {
      const card = await makeCard(linus, 'From a member')
      expect(card).toMatchObject({ board_id: boardId, list_id: listA, created_by: linus.userId })
    })

    it('is refused to someone outside the team', async () => {
      const { error } = await mallory.db.rpc('create_card', {
        p_list_id: listA,
        p_title: 'Sneaky',
        p_position: 'm9',
      })
      expect(error?.code).toBe('42501')
    })

    it('is refused to a caller with no session', async () => {
      const { error } = await anonClient().rpc('create_card', {
        p_list_id: listA,
        p_title: 'Sneaky',
        p_position: 'm9',
      })
      expect(error).not.toBeNull()
    })

    it('reports a list that does not exist as not found', async () => {
      const { error } = await linus.db.rpc('create_card', {
        p_list_id: '00000000-0000-4000-8000-000000000000',
        p_title: 'Ghost',
        p_position: 'm9',
      })
      expect(error?.code).toBe('PT404')
    })
  })

  describe('move_card', () => {
    it('moves a card between lists on the same board', async () => {
      const card = await makeCard(linus, 'Movable')
      const { data, error } = await linus.db.rpc('move_card', {
        p_card_id: card.id,
        p_list_id: listB,
        p_position: 'b0',
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({ list_id: listB, position: 'b0' })
    })

    it('refuses to move a card onto a different board', async () => {
      const card = await makeCard(ada, 'Stay put')
      const { error } = await ada.db.rpc('move_card', {
        p_card_id: card.id,
        p_list_id: otherList,
        p_position: 'b0',
      })
      expect(error?.code).toBe('22023')
    })

    it('is refused to someone outside the team', async () => {
      const card = await makeCard(ada, 'Not yours')
      const { error } = await mallory.db.rpc('move_card', {
        p_card_id: card.id,
        p_list_id: listB,
        p_position: 'b0',
      })
      expect(error?.code).toBe('42501')
    })

    it('is refused while the board is archived', async () => {
      const card = await makeCard(ada, 'Frozen')
      await ada.db.from('boards').update({ archived: true }).eq('id', boardId)

      const { error } = await ada.db.rpc('move_card', {
        p_card_id: card.id,
        p_list_id: listB,
        p_position: 'b0',
      })
      expect(error?.code).toBe('42501')

      await ada.db.from('boards').update({ archived: false }).eq('id', boardId)
    })
  })

  describe('assignees', () => {
    it('are all readable, so "my cards" has to filter on user_id in the query', async () => {
      const card = await makeCard(ada, 'Shared')
      await ada.db
        .from('card_assignees')
        .insert([{ card_id: card.id, user_id: linus.userId, assigned_by: ada.userId }])

      const all = await linus.db.from('card_assignees').select('user_id').eq('card_id', card.id)
      expect(all.data).toHaveLength(1)

      const mine = await linus.db
        .from('card_assignees')
        .select('card_id')
        .eq('card_id', card.id)
        .eq('user_id', linus.userId)
      expect(mine.data).toHaveLength(1)
    })

    it('are invisible to someone outside the team', async () => {
      const card = await makeCard(ada, 'Private work')
      const { data } = await mallory.db
        .from('card_assignees')
        .select('user_id')
        .eq('card_id', card.id)
      expect(data).toEqual([])
    })
  })
})
