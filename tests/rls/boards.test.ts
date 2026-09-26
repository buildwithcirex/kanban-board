import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, rlsSuiteEnabled, signInAs, signOutAll, type TestClient } from './client'

/**
 * Boards, lists and background storage, against the dev Supabase project.
 *
 * The seeded board is shared with the other suites, so this one works on boards it creates and
 * deletes them again in `afterEach`. Running the whole suite twice in a row is the check that it
 * cleans up after itself.
 */

const suite = rlsSuiteEnabled ? describe : describe.skip

suite('RLS: boards and lists', () => {
  let ada: TestClient
  let grace: TestClient
  let linus: TestClient
  let mallory: TestClient
  let productTeamId: string
  let seededBoardId: string
  // Each board is remembered with the client that made it: a private board is invisible to
  // everyone else, and Postgres applies SELECT policies when a DELETE filters on a column, so
  // only its own member can clean it up.
  const scratchBoards: { id: string; client: () => TestClient }[] = []

  /** Creates a board owned by this suite and schedules it for deletion. */
  async function makeBoard(
    client: TestClient,
    title: string,
    visibility: 'team' | 'private' = 'team',
    withLists = false,
  ) {
    const { data, error } = await client.db.rpc('create_board', {
      p_team_id: productTeamId,
      p_title: title,
      p_position: `z${scratchBoards.length}`,
      p_visibility: visibility,
      p_with_default_lists: withLists,
    })
    expect(error, `could not create ${title}`).toBeNull()
    scratchBoards.push({ id: data!.id, client: () => client })
    return data!
  }

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
    if (!board) throw new Error('Seed board "Roadmap" missing.')
    seededBoardId = board.id
  }, 30_000)

  afterEach(async () => {
    // Deleting a board cascades to its lists and members, but needs both halves of the rule:
    // only a team admin may delete, and only someone who can see the board may target it. The
    // creator covers private boards; an admin covers boards made by a plain member.
    await Promise.all(
      scratchBoards.map(async ({ id, client }) => {
        await client().db.from('boards').delete().eq('id', id)
        await grace.db.from('boards').delete().eq('id', id)
      }),
    )
    scratchBoards.length = 0
    await grace.db.from('boards').update({ archived: false }).eq('id', seededBoardId)
  })

  afterAll(async () => {
    await signOutAll([ada, grace, linus, mallory].filter(Boolean))
  })

  describe('create_board', () => {
    it('is refused to someone outside the team', async () => {
      const { error } = await mallory.db.rpc('create_board', {
        p_team_id: productTeamId,
        p_title: 'Sneaky',
        p_position: 'z9',
      })
      expect(error?.code).toBe('42501')
    })

    it('is refused to a caller with no session', async () => {
      const { error } = await anonClient().rpc('create_board', {
        p_team_id: productTeamId,
        p_title: 'Sneaky',
        p_position: 'z9',
      })
      expect(error).not.toBeNull()
    })

    it('lets any team member create a board and read it back', async () => {
      const board = await makeBoard(linus, 'Member board')
      expect(board).toMatchObject({ title: 'Member board', visibility: 'team' })
      expect(board.created_by).toBe(linus.userId)
    })

    it('seeds the three default lists in order', async () => {
      const board = await makeBoard(linus, 'With lists', 'team', true)
      const { data } = await linus.db
        .from('lists')
        .select('title')
        .eq('board_id', board.id)
        .order('position')
      expect(data?.map((row) => row.title)).toEqual(['To do', 'In progress', 'Done'])
    })

    it('rejects a blank title', async () => {
      const { error } = await linus.db.rpc('create_board', {
        p_team_id: productTeamId,
        p_title: '   ',
        p_position: 'z9',
      })
      expect(error).not.toBeNull()
    })
  })

  describe('a plain insert', () => {
    it('can now read a team board back', async () => {
      // The SELECT policy tests the row's own columns, so RETURNING has something to check.
      const { data, error } = await ada.db
        .from('boards')
        .insert({
          team_id: productTeamId,
          title: 'Direct insert',
          position: 'zz1',
          created_by: ada.userId,
        })
        .select()
        .single()
      expect(error).toBeNull()
      if (data) scratchBoards.push({ id: data.id, client: () => ada })
    })

    it('still cannot read a private board back, which is why the RPC exists', async () => {
      const { error } = await ada.db
        .from('boards')
        .insert({
          team_id: productTeamId,
          title: 'Direct private',
          position: 'zz2',
          visibility: 'private',
          created_by: ada.userId,
        })
        .select()
        .single()
      expect(error?.code).toBe('42501')
    })

    it('is refused to someone outside the team', async () => {
      const { error } = await mallory.db.from('boards').insert({
        team_id: productTeamId,
        title: 'Sneaky',
        position: 'zz3',
        created_by: mallory.userId,
      })
      expect(error?.code).toBe('42501')
    })
  })

  describe('private boards', () => {
    it('are invisible to the rest of the team, admins included', async () => {
      const board = await makeBoard(ada, 'Secret plans', 'private')

      const mine = await ada.db.from('boards').select('id').eq('id', board.id)
      expect(mine.data).toHaveLength(1)

      const theirs = await linus.db.from('boards').select('id').eq('id', board.id)
      expect(theirs.data).toEqual([])

      const admin = await grace.db.from('boards').select('id').eq('id', board.id)
      expect(admin.data).toEqual([])
    })

    it('hide their lists too', async () => {
      const board = await makeBoard(ada, 'Secret with lists', 'private', true)
      const { data } = await linus.db.from('lists').select('id').eq('board_id', board.id)
      expect(data).toEqual([])
    })

    it('become visible once someone is added', async () => {
      const board = await makeBoard(ada, 'Shared secret', 'private')
      const { error } = await ada.db
        .from('board_members')
        .insert({ board_id: board.id, user_id: linus.userId })
      expect(error).toBeNull()

      const { data } = await linus.db.from('boards').select('id').eq('id', board.id)
      expect(data).toHaveLength(1)
    })

    it('cannot be joined by an outsider', async () => {
      const board = await makeBoard(ada, 'Not for Mallory', 'private')
      const { error } = await mallory.db
        .from('board_members')
        .insert({ board_id: board.id, user_id: mallory.userId })
      expect(error?.code).toBe('42501')
    })
  })

  describe('set_board_visibility', () => {
    it('keeps the board reachable by whoever made it private', async () => {
      const board = await makeBoard(grace, 'Going private')

      const { data, error } = await grace.db.rpc('set_board_visibility', {
        p_board_id: board.id,
        p_visibility: 'private',
      })
      expect(error).toBeNull()
      expect(data?.visibility).toBe('private')

      const stillMine = await grace.db.from('boards').select('id').eq('id', board.id)
      expect(stillMine.data).toHaveLength(1)

      const others = await linus.db.from('boards').select('id').eq('id', board.id)
      expect(others.data).toEqual([])
    })

    it('is refused to someone outside the team', async () => {
      const board = await makeBoard(grace, 'Not yours')
      const { error } = await mallory.db.rpc('set_board_visibility', {
        p_board_id: board.id,
        p_visibility: 'private',
      })
      expect(error?.code).toBe('42501')
    })
  })

  describe('archiving', () => {
    it('makes the board read-only without hiding it', async () => {
      await grace.db.from('boards').update({ archived: true }).eq('id', seededBoardId)

      const { data: visible } = await linus.db
        .from('boards')
        .select('id, archived')
        .eq('id', seededBoardId)
      expect(visible).toEqual([{ id: seededBoardId, archived: true }])

      const insert = await linus.db
        .from('lists')
        .insert({ board_id: seededBoardId, title: 'Nope', position: 'zz9' })
      expect(insert.error?.code).toBe('42501')
    })

    it('can be undone, after which edits work again', async () => {
      await grace.db.from('boards').update({ archived: true }).eq('id', seededBoardId)
      await grace.db.from('boards').update({ archived: false }).eq('id', seededBoardId)

      const { data, error } = await linus.db
        .from('lists')
        .insert({ board_id: seededBoardId, title: 'Back again', position: 'zz8' })
        .select()
        .single()
      expect(error).toBeNull()

      if (data) await linus.db.from('lists').delete().eq('id', data.id)
    })
  })

  describe('board deletion', () => {
    it('is refused to a plain member and allowed for an admin', async () => {
      const board = await makeBoard(grace, 'Doomed')

      const byMember = await linus.db.from('boards').delete().eq('id', board.id).select()
      expect(byMember.data ?? []).toHaveLength(0)

      const byAdmin = await grace.db.from('boards').delete().eq('id', board.id).select()
      expect(byAdmin.data).toHaveLength(1)
    })

    it('is out of reach for an admin who cannot see the board', async () => {
      // A team admin who is not on a private board cannot delete it: Postgres applies the SELECT
      // policy to a DELETE that filters on a column, so the row simply is not there for them.
      const board = await makeBoard(ada, 'Admin blind spot', 'private')
      const { data } = await grace.db.from('boards').delete().eq('id', board.id).select()
      expect(data ?? []).toHaveLength(0)

      const stillThere = await ada.db.from('boards').select('id').eq('id', board.id)
      expect(stillThere.data).toHaveLength(1)
    })
  })

  describe('lists', () => {
    it('can be added, renamed and archived by any team member', async () => {
      const board = await makeBoard(linus, 'List work')

      const created = await linus.db
        .from('lists')
        .insert({ board_id: board.id, title: 'Backlog', position: 'a0' })
        .select()
        .single()
      expect(created.error).toBeNull()

      const renamed = await linus.db
        .from('lists')
        .update({ title: 'Icebox' })
        .eq('id', created.data!.id)
        .select()
        .single()
      expect(renamed.data?.title).toBe('Icebox')

      const archived = await linus.db
        .from('lists')
        .update({ archived: true })
        .eq('id', created.data!.id)
        .select()
        .single()
      expect(archived.data?.archived).toBe(true)
    })

    it('are refused to someone outside the team', async () => {
      const board = await makeBoard(linus, 'Closed board')

      const insert = await mallory.db
        .from('lists')
        .insert({ board_id: board.id, title: 'Nope', position: 'a0' })
      expect(insert.error?.code).toBe('42501')

      const update = await mallory.db
        .from('lists')
        .update({ title: 'Pwned' })
        .eq('board_id', board.id)
        .select()
      expect(update.data ?? []).toHaveLength(0)
    })

    it('reject a WIP limit of zero', async () => {
      const board = await makeBoard(linus, 'Wip board')
      const { error } = await linus.db
        .from('lists')
        .insert({ board_id: board.id, title: 'Bad', position: 'a0', wip_limit: 0 })
      expect(error).not.toBeNull()
      expect(error?.code).not.toBe('42501')
    })
  })

  describe('background storage', () => {
    const bucket = 'board-backgrounds'
    const onePixelPng = () =>
      new Blob(
        [
          Uint8Array.from(
            atob(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            ),
            (c) => c.charCodeAt(0),
          ),
        ],
        { type: 'image/png' },
      )

    it('lets a team member upload into their own board folder', async () => {
      const path = `${seededBoardId}/${crypto.randomUUID()}.png`
      const { error } = await linus.db.storage
        .from(bucket)
        .upload(path, onePixelPng(), { contentType: 'image/png' })
      expect(error).toBeNull()

      const signed = await linus.db.storage.from(bucket).createSignedUrl(path, 60)
      expect(signed.data?.signedUrl).toContain(path)

      await linus.db.storage.from(bucket).remove([path])
    })

    it('refuses an outsider, both writing and reading', async () => {
      const path = `${seededBoardId}/${crypto.randomUUID()}.png`
      const upload = await mallory.db.storage
        .from(bucket)
        .upload(path, onePixelPng(), { contentType: 'image/png' })
      expect(upload.error).not.toBeNull()

      const seeded = `${seededBoardId}/${crypto.randomUUID()}.png`
      await ada.db.storage.from(bucket).upload(seeded, onePixelPng(), { contentType: 'image/png' })

      const listed = await mallory.db.storage.from(bucket).list(seededBoardId)
      expect(listed.data ?? []).toHaveLength(0)

      const signed = await mallory.db.storage.from(bucket).createSignedUrl(seeded, 60)
      expect(signed.error).not.toBeNull()

      await ada.db.storage.from(bucket).remove([seeded])
    })

    it('refuses an upload that is not filed under a board', async () => {
      const { error } = await linus.db.storage
        .from(bucket)
        .upload(`loose-${crypto.randomUUID()}.png`, onePixelPng(), { contentType: 'image/png' })
      expect(error).not.toBeNull()
    })

    it('is not a public bucket', async () => {
      const path = `${seededBoardId}/${crypto.randomUUID()}.png`
      await linus.db.storage.from(bucket).upload(path, onePixelPng(), { contentType: 'image/png' })

      // A public URL is just a string; fetching it is what proves the bucket is private.
      const { data } = linus.db.storage.from(bucket).getPublicUrl(path)
      const response = await fetch(data.publicUrl)
      expect(response.ok).toBe(false)

      await linus.db.storage.from(bucket).remove([path])
    })
  })
})
