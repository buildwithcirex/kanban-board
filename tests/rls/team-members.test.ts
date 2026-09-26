import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, rlsSuiteEnabled, signInAs, signOutAll, type TestClient } from './client'

/**
 * The Phase 2 membership RPCs, against the dev Supabase project.
 *
 * These are `security definer`, so RLS does not protect them — each one re-checks the caller
 * itself. That makes network tests the only proof that the checks are actually there, which is
 * why every "cannot" below is asserted on the real error code rather than on the UI hiding a
 * button.
 *
 * Codes: 42501 not allowed · PT404 no such account/member · 23505 already a member ·
 * 22023 bad argument.
 *
 * The suite shares the seeded fixture with isolation.test.ts, so anything it changes it puts
 * back: Product must end as ada (owner), grace (admin), linus (member).
 */

const suite = rlsSuiteEnabled ? describe : describe.skip

suite('RLS: team membership RPCs', () => {
  let ada: TestClient
  let grace: TestClient
  let linus: TestClient
  let mallory: TestClient
  let productTeamId: string

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
  }, 30_000)

  // Every test leaves the fixture as it found it, whether it passed or not.
  afterEach(async () => {
    await grace.db.rpc('remove_team_member', {
      p_team_id: productTeamId,
      p_user_id: mallory.userId,
    })
    await grace.db.rpc('set_team_member_role', {
      p_team_id: productTeamId,
      p_user_id: linus.userId,
      p_role: 'member',
    })
    const { data: linusMembership } = await linus.db
      .from('team_members')
      .select('user_id')
      .eq('team_id', productTeamId)
      .eq('user_id', linus.userId)
    if ((linusMembership ?? []).length === 0) {
      await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'linus@kanban.test',
        p_role: 'member',
      })
    }
  })

  afterAll(async () => {
    await signOutAll([ada, grace, linus, mallory].filter(Boolean))
  })

  describe('add_team_member', () => {
    it('is refused to a plain member', async () => {
      const { error } = await linus.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })
      expect(error?.code).toBe('42501')
    })

    it('is refused to someone outside the team', async () => {
      const { error } = await mallory.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })
      expect(error?.code).toBe('42501')
    })

    it('is refused to a caller with no session', async () => {
      const { error } = await anonClient().rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })
      expect(error).not.toBeNull()
    })

    it('lets an admin add an existing account, ignoring case and stray spaces', async () => {
      const { data, error } = await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: '  MALLORY@Kanban.TEST  ',
      })
      expect(error).toBeNull()
      expect(data).toMatchObject({ user_id: mallory.userId, role: 'member' })
    })

    it('gives the new member sight of the team straight away', async () => {
      await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })

      const { data: teams } = await mallory.db.from('teams').select('id').eq('id', productTeamId)
      expect(teams).toHaveLength(1)

      const { data: boards } = await mallory.db
        .from('boards')
        .select('title')
        .eq('team_id', productTeamId)
      expect((boards ?? []).length).toBeGreaterThan(0)
    })

    it('notifies the person who was added', async () => {
      await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })

      const { data } = await mallory.db
        .from('notifications')
        .select('type, team_id, actor_id')
        .eq('type', 'added_to_team')
        .order('created_at', { ascending: false })
        .limit(1)

      expect(data?.[0]).toMatchObject({
        type: 'added_to_team',
        team_id: productTeamId,
        actor_id: grace.userId,
      })
    })

    it('records the change in the team activity feed', async () => {
      await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })

      const { data } = await grace.db
        .from('activity')
        .select('type, actor_id')
        .eq('team_id', productTeamId)
        .eq('type', 'team.member_added')
        .order('created_at', { ascending: false })
        .limit(1)

      expect(data?.[0]).toMatchObject({ type: 'team.member_added', actor_id: grace.userId })
    })

    it('reports an unknown address as not found, not as a server error', async () => {
      const { error } = await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'nobody@kanban.test',
      })
      // PT404 tells PostgREST to answer 404; plain no_data_found would surface as a 500.
      expect(error?.code).toBe('PT404')
    })

    it('reports someone already in the team as a conflict', async () => {
      const { error } = await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'linus@kanban.test',
      })
      expect(error?.code).toBe('23505')
    })

    it('refuses to mint a second owner', async () => {
      const { error } = await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
        p_role: 'owner',
      })
      expect(error?.code).toBe('22023')
    })
  })

  describe('set_team_member_role', () => {
    it('is refused to a plain member', async () => {
      const { error } = await linus.db.rpc('set_team_member_role', {
        p_team_id: productTeamId,
        p_user_id: linus.userId,
        p_role: 'admin',
      })
      expect(error?.code).toBe('42501')
    })

    it('lets an admin promote and demote a member', async () => {
      const promoted = await grace.db.rpc('set_team_member_role', {
        p_team_id: productTeamId,
        p_user_id: linus.userId,
        p_role: 'admin',
      })
      expect(promoted.error).toBeNull()
      expect(promoted.data).toMatchObject({ user_id: linus.userId, role: 'admin' })

      const demoted = await grace.db.rpc('set_team_member_role', {
        p_team_id: productTeamId,
        p_user_id: linus.userId,
        p_role: 'member',
      })
      expect(demoted.data).toMatchObject({ role: 'member' })
    })

    it("refuses to change the owner's role, even for the owner themselves", async () => {
      const byAdmin = await grace.db.rpc('set_team_member_role', {
        p_team_id: productTeamId,
        p_user_id: ada.userId,
        p_role: 'member',
      })
      expect(byAdmin.error?.code).toBe('42501')

      const byOwner = await ada.db.rpc('set_team_member_role', {
        p_team_id: productTeamId,
        p_user_id: ada.userId,
        p_role: 'member',
      })
      expect(byOwner.error?.code).toBe('42501')
    })

    it('refuses to promote anyone to owner', async () => {
      const { error } = await grace.db.rpc('set_team_member_role', {
        p_team_id: productTeamId,
        p_user_id: linus.userId,
        p_role: 'owner',
      })
      expect(error?.code).toBe('22023')
    })

    it('reports a non-member as not found', async () => {
      const { error } = await grace.db.rpc('set_team_member_role', {
        p_team_id: productTeamId,
        p_user_id: mallory.userId,
        p_role: 'admin',
      })
      expect(error?.code).toBe('PT404')
    })
  })

  describe('remove_team_member', () => {
    it('is refused to a member removing someone else', async () => {
      const { error } = await linus.db.rpc('remove_team_member', {
        p_team_id: productTeamId,
        p_user_id: grace.userId,
      })
      expect(error?.code).toBe('42501')
    })

    it('is refused to someone outside the team', async () => {
      const { error } = await mallory.db.rpc('remove_team_member', {
        p_team_id: productTeamId,
        p_user_id: linus.userId,
      })
      expect(error?.code).toBe('42501')
    })

    it('refuses to remove the owner, by anyone including the owner', async () => {
      const byAdmin = await grace.db.rpc('remove_team_member', {
        p_team_id: productTeamId,
        p_user_id: ada.userId,
      })
      expect(byAdmin.error?.code).toBe('42501')

      const byOwner = await ada.db.rpc('remove_team_member', {
        p_team_id: productTeamId,
        p_user_id: ada.userId,
      })
      expect(byOwner.error?.code).toBe('42501')
    })

    it('lets an admin remove a member, who then loses sight of the team', async () => {
      await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })

      const { error } = await grace.db.rpc('remove_team_member', {
        p_team_id: productTeamId,
        p_user_id: mallory.userId,
      })
      expect(error).toBeNull()

      const { data: teams } = await mallory.db.from('teams').select('id').eq('id', productTeamId)
      expect(teams).toEqual([])

      const { data: cards } = await mallory.db.from('cards').select('id')
      expect(cards).toEqual([])
    })

    it('lets a member leave under their own steam', async () => {
      await grace.db.rpc('add_team_member', {
        p_team_id: productTeamId,
        p_email: 'mallory@kanban.test',
      })

      const { error } = await mallory.db.rpc('remove_team_member', {
        p_team_id: productTeamId,
        p_user_id: mallory.userId,
      })
      expect(error).toBeNull()

      const { data } = await mallory.db.from('teams').select('id').eq('id', productTeamId)
      expect(data).toEqual([])
    })

    it('reports a non-member as not found', async () => {
      const { error } = await grace.db.rpc('remove_team_member', {
        p_team_id: productTeamId,
        p_user_id: mallory.userId,
      })
      expect(error?.code).toBe('PT404')
    })
  })
})
