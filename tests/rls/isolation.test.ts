import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, rlsSuiteEnabled, signInAs, signOutAll, type TestClient } from './client'

/**
 * Row Level Security, proven against the dev Supabase project.
 *
 * Seeded fixture (supabase/seed.sql):
 *   team "Product"   — ada (owner), grace (admin), linus (member), board "Roadmap"
 *   team "Outsiders" — mallory (owner), nothing else
 *
 * Mallory shares no team with anyone, so every "cannot" below is the real answer from Postgres.
 *
 * PostgREST reports a denied SELECT as an empty result set and a denied INSERT/UPDATE/DELETE as
 * error 42501, so reads are asserted on row counts and writes on the error.
 */

const suite = rlsSuiteEnabled ? describe : describe.skip

suite('RLS: team isolation', () => {
  let ada: TestClient
  let grace: TestClient
  let linus: TestClient
  let mallory: TestClient
  let productTeamId: string
  let roadmapBoardId: string
  let firstCardId: string

  beforeAll(async () => {
    ;[ada, grace, linus, mallory] = await Promise.all([
      signInAs('ada'),
      signInAs('grace'),
      signInAs('linus'),
      signInAs('mallory'),
    ])

    const { data: team } = await ada.db.from('teams').select('id').eq('name', 'Product').single()
    if (!team) throw new Error('Seed data missing: run supabase/seed.sql against the dev project.')
    productTeamId = team.id

    const { data: board } = await ada.db
      .from('boards')
      .select('id')
      .eq('team_id', productTeamId)
      .eq('title', 'Roadmap')
      .single()
    if (!board) throw new Error('Seed board "Roadmap" missing: run supabase/seed.sql.')
    roadmapBoardId = board.id

    const { data: card } = await ada.db
      .from('cards')
      .select('id')
      .eq('board_id', roadmapBoardId)
      .order('position')
      .limit(1)
      .single()
    if (!card) throw new Error('Seed cards missing: run supabase/seed.sql.')
    firstCardId = card.id
  }, 30_000)

  afterAll(async () => {
    await signOutAll([ada, grace, linus, mallory].filter(Boolean))
  })

  describe('an anonymous caller holding only the public anon key', () => {
    it('reads nothing at all', async () => {
      const db = anonClient()
      for (const table of ['profiles', 'teams', 'boards', 'lists', 'cards'] as const) {
        // Either a permission error or an empty set — never a row.
        const { data } = await db.from(table).select('*').limit(1)
        expect(data ?? [], `anon could read ${table}`).toHaveLength(0)
      }
    })

    it('cannot write', async () => {
      const { error } = await anonClient()
        .from('teams')
        .insert({ name: 'anon team', created_by: null })
      expect(error).not.toBeNull()
    })
  })

  describe('a user outside the team', () => {
    it('cannot see the team', async () => {
      const { data } = await mallory.db.from('teams').select('id').eq('id', productTeamId)
      expect(data).toEqual([])
    })

    it('cannot see its members, boards, lists or cards', async () => {
      const [members, boards, lists, cards] = await Promise.all([
        mallory.db.from('team_members').select('user_id').eq('team_id', productTeamId),
        mallory.db.from('boards').select('id').eq('id', roadmapBoardId),
        mallory.db.from('lists').select('id').eq('board_id', roadmapBoardId),
        mallory.db.from('cards').select('id').eq('board_id', roadmapBoardId),
      ])
      expect(members.data).toEqual([])
      expect(boards.data).toEqual([])
      expect(lists.data).toEqual([])
      expect(cards.data).toEqual([])
    })

    it('cannot see the profiles of people she shares no team with', async () => {
      const { data } = await mallory.db.from('profiles').select('email')
      expect(data?.map((row) => row.email)).toEqual([mallory.email])
    })

    it('cannot create a card on the team board', async () => {
      const { data: list } = await ada.db
        .from('lists')
        .select('id')
        .eq('board_id', roadmapBoardId)
        .limit(1)
        .single()

      const { error } = await mallory.db.from('cards').insert({
        board_id: roadmapBoardId,
        list_id: list!.id,
        title: 'injected',
        position: 'zz',
        created_by: mallory.userId,
      })
      expect(error?.code).toBe('42501')
    })

    it('cannot update or delete someone else’s card', async () => {
      const update = await mallory.db
        .from('cards')
        .update({ title: 'hijacked' })
        .eq('id', firstCardId)
        .select()
      expect(update.data ?? []).toHaveLength(0)

      const remove = await mallory.db.from('cards').delete().eq('id', firstCardId).select()
      expect(remove.data ?? []).toHaveLength(0)
    })

    it('cannot add herself to the team', async () => {
      const { error } = await mallory.db
        .from('team_members')
        .insert({ team_id: productTeamId, user_id: mallory.userId, role: 'member' })
      expect(error?.code).toBe('42501')
    })

    it('cannot assign herself to a card', async () => {
      const { error } = await mallory.db.from('card_assignees').insert({
        card_id: firstCardId,
        user_id: mallory.userId,
        assigned_by: mallory.userId,
      })
      expect(error?.code).toBe('42501')
    })
  })

  describe('a team member', () => {
    it('sees the team board and its cards', async () => {
      const { data: boards } = await linus.db.from('boards').select('id').eq('id', roadmapBoardId)
      expect(boards).toHaveLength(1)

      const { data: cards } = await linus.db
        .from('cards')
        .select('id')
        .eq('board_id', roadmapBoardId)
      expect(cards?.length ?? 0).toBeGreaterThan(0)
    })

    it('sees the profiles of teammates only', async () => {
      const { data } = await linus.db.from('profiles').select('email')
      const emails = (data ?? []).map((row) => row.email).sort()
      expect(emails).toEqual(['ada@kanban.test', 'grace@kanban.test', 'linus@kanban.test'])
    })

    it('sees every membership row of their team, not just their own', async () => {
      // Why listMyTeams() filters on user_id: without it the same team comes back once per
      // teammate. This is deliberate — it is what makes the member list readable.
      const { data } = await linus.db
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', productTeamId)
      expect(data).toHaveLength(3)

      const { data: mine } = await linus.db
        .from('team_members')
        .select('role')
        .eq('team_id', productTeamId)
        .eq('user_id', linus.userId)
      expect(mine).toEqual([{ role: 'member' }])
    })

    it('cannot promote themselves to admin', async () => {
      const { data } = await linus.db
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', productTeamId)
        .eq('user_id', linus.userId)
        .select()
      expect(data ?? []).toHaveLength(0)

      const { data: after } = await linus.db
        .from('team_members')
        .select('role')
        .eq('team_id', productTeamId)
        .eq('user_id', linus.userId)
        .single()
      expect(after?.role).toBe('member')
    })

    it('cannot delete the board', async () => {
      const { data } = await linus.db.from('boards').delete().eq('id', roadmapBoardId).select()
      expect(data ?? []).toHaveLength(0)

      const { data: stillThere } = await ada.db.from('boards').select('id').eq('id', roadmapBoardId)
      expect(stillThere).toHaveLength(1)
    })

    it('can create and remove a card of their own', async () => {
      const { data: list } = await linus.db
        .from('lists')
        .select('id')
        .eq('board_id', roadmapBoardId)
        .limit(1)
        .single()

      const { data: created, error } = await linus.db
        .from('cards')
        .insert({
          board_id: roadmapBoardId,
          list_id: list!.id,
          title: 'RLS suite scratch card',
          position: 'zzz',
          created_by: linus.userId,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(created?.title).toBe('RLS suite scratch card')

      await linus.db.from('cards').delete().eq('id', created!.id)
      const { data: gone } = await linus.db.from('cards').select('id').eq('id', created!.id)
      expect(gone).toEqual([])
    })
  })

  describe('a team admin', () => {
    it('cannot demote or remove the owner', async () => {
      const { data: owner } = await grace.db
        .from('team_members')
        .select('user_id')
        .eq('team_id', productTeamId)
        .eq('role', 'owner')
        .single()

      const demote = await grace.db
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', productTeamId)
        .eq('user_id', owner!.user_id)
        .select()
      expect(demote.data ?? []).toHaveLength(0)

      const remove = await grace.db
        .from('team_members')
        .delete()
        .eq('team_id', productTeamId)
        .eq('user_id', owner!.user_id)
        .select()
      expect(remove.data ?? []).toHaveLength(0)
    })
  })

  describe('creating a team', () => {
    const created: string[] = []

    afterAll(async () => {
      // Owners may delete their own teams; everything below cascades.
      await Promise.all(created.map((id) => mallory.db.from('teams').delete().eq('id', id)))
    })

    it('makes the caller its owner and is invisible to everyone else', async () => {
      const { data: team, error } = await mallory.db.rpc('create_team', {
        p_name: `RLS suite ${Date.now()}`,
      })
      expect(error).toBeNull()
      expect(team).not.toBeNull()
      created.push(team!.id)

      const { data: membership } = await mallory.db
        .from('team_members')
        .select('role')
        .eq('team_id', team!.id)
      expect(membership).toEqual([{ role: 'owner' }])

      const { data: seenByOthers } = await linus.db.from('teams').select('id').eq('id', team!.id)
      expect(seenByOthers).toEqual([])
    })

    it('cannot be forged on behalf of another user', async () => {
      const { error } = await mallory.db
        .from('teams')
        .insert({ name: 'impersonated', created_by: ada.userId })
      expect(error?.code).toBe('42501')
    })
  })

  describe('identity fields', () => {
    it('refuses to let a user rewrite their own email', async () => {
      const { data } = await linus.db
        .from('profiles')
        .update({ email: 'ada@kanban.test' })
        .eq('id', linus.userId)
        .select()
        .single()
      expect(data?.email).toBe('linus@kanban.test')
    })

    it('refuses to let a user edit someone else’s profile', async () => {
      const { data } = await linus.db
        .from('profiles')
        .update({ name: 'Not Ada' })
        .eq('id', ada.userId)
        .select()
      expect(data ?? []).toHaveLength(0)
    })
  })

  describe('notifications and push subscriptions', () => {
    it('are readable only by their owner', async () => {
      const { data } = await linus.db.from('notifications').select('user_id')
      expect((data ?? []).every((row) => row.user_id === linus.userId)).toBe(true)
    })

    it('cannot be created for another user', async () => {
      const { error } = await linus.db.from('push_subscriptions').insert({
        user_id: ada.userId,
        endpoint: `https://example.test/${crypto.randomUUID()}`,
        p256dh: 'x',
        auth: 'y',
      })
      expect(error?.code).toBe('42501')
    })
  })
})
