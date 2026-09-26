import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import type { Board } from '@/lib/api/boards'
import type { List } from '@/lib/api/lists'
import type { Team, TeamRole } from '@/lib/api/teams'
import { renderApp } from '@/test/renderApp'
// Type-only, so it is erased before the hoisted vi.mock factories run.
import type * as BoardsApi from '@/lib/api/boards'
import type * as ListsApi from '@/lib/api/lists'
import type * as TeamsApi from '@/lib/api/teams'

vi.mock('@/lib/api/boards', async (importOriginal) => {
  // parseBackground / serializeBackground are pure helpers the components rely on; only the
  // network calls need stubbing.
  const actual = await importOriginal<typeof BoardsApi>()
  return {
    ...actual,
    listTeamBoards: vi.fn<typeof BoardsApi.listTeamBoards>(),
    listAllBoards: vi.fn<typeof BoardsApi.listAllBoards>(),
    getBoard: vi.fn<typeof BoardsApi.getBoard>(),
    createBoard: vi.fn<typeof BoardsApi.createBoard>(),
    updateBoard: vi.fn<typeof BoardsApi.updateBoard>(),
    setBoardVisibility: vi.fn<typeof BoardsApi.setBoardVisibility>(),
    deleteBoard: vi.fn<typeof BoardsApi.deleteBoard>(),
    listBoardMembers: vi.fn<typeof BoardsApi.listBoardMembers>(),
    addBoardMember: vi.fn<typeof BoardsApi.addBoardMember>(),
    removeBoardMember: vi.fn<typeof BoardsApi.removeBoardMember>(),
    uploadBoardBackground: vi.fn<typeof BoardsApi.uploadBoardBackground>(),
    signBackgroundUrl: vi.fn<typeof BoardsApi.signBackgroundUrl>(),
    deleteBoardBackground: vi.fn<typeof BoardsApi.deleteBoardBackground>(),
  }
})

vi.mock('@/lib/api/lists', () => ({
  listBoardLists: vi.fn<typeof ListsApi.listBoardLists>(),
  createList: vi.fn<typeof ListsApi.createList>(),
  updateList: vi.fn<typeof ListsApi.updateList>(),
  deleteList: vi.fn<typeof ListsApi.deleteList>(),
}))

vi.mock('@/lib/api/teams', () => ({
  listMyTeams: vi.fn<typeof TeamsApi.listMyTeams>(),
  listTeamMembers: vi.fn<typeof TeamsApi.listTeamMembers>(),
  getTeam: vi.fn<typeof TeamsApi.getTeam>(),
  createTeam: vi.fn<typeof TeamsApi.createTeam>(),
  updateTeam: vi.fn<typeof TeamsApi.updateTeam>(),
  deleteTeam: vi.fn<typeof TeamsApi.deleteTeam>(),
  addTeamMember: vi.fn<typeof TeamsApi.addTeamMember>(),
  setTeamMemberRole: vi.fn<typeof TeamsApi.setTeamMemberRole>(),
  removeTeamMember: vi.fn<typeof TeamsApi.removeTeamMember>(),
}))

const boardsApi = await import('@/lib/api/boards')
const listsApi = await import('@/lib/api/lists')
const teamsApi = await import('@/lib/api/teams')

const TEAM_ID = 'team-1'
const BOARD_ID = 'board-1'
const path = `/t/${TEAM_ID}/b/${BOARD_ID}`

const team: Team = {
  id: TEAM_ID,
  name: 'Product',
  description: null,
  color: '#4b7bec',
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: BOARD_ID,
    team_id: TEAM_ID,
    title: 'Roadmap',
    background: null,
    visibility: 'team',
    archived: false,
    position: 'a0',
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeList(id: string, title: string, overrides: Partial<List> = {}): List {
  return {
    id,
    board_id: BOARD_ID,
    title,
    position: id,
    wip_limit: null,
    archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function setup({
  board = makeBoard(),
  lists = [makeList('a0', 'To do'), makeList('a1', 'In progress')],
  archivedLists = [] as List[],
  role = 'member' as TeamRole,
} = {}) {
  vi.mocked(boardsApi.getBoard).mockResolvedValue(board)
  vi.mocked(teamsApi.listMyTeams).mockResolvedValue([{ team, role }])
  vi.mocked(boardsApi.listBoardMembers).mockResolvedValue([])
  vi.mocked(listsApi.listBoardLists).mockImplementation(async (_id, options) =>
    options?.archived ? archivedLists : lists,
  )
  return { board, lists }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BoardPage', () => {
  it('shows the board and its lists', async () => {
    setup()
    renderApp(path)

    expect(await screen.findByRole('heading', { name: /Roadmap/ })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'To do' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'In progress' })).toBeInTheDocument()
  })

  it('uses the board title as the page title', async () => {
    setup()
    renderApp(path)
    await screen.findByRole('region', { name: 'To do' })
    await waitFor(() => expect(document.title).toBe('Roadmap · Kanban'))
  })

  it('adds a list after the existing ones', async () => {
    const { lists } = setup()
    vi.mocked(listsApi.createList).mockResolvedValue(makeList('a2', 'In review'))
    renderApp(path)
    await screen.findByRole('region', { name: 'To do' })

    await userEvent.click(screen.getByRole('button', { name: '+ Add a list' }))
    await userEvent.type(screen.getByLabelText('List title'), 'In review')
    await userEvent.click(screen.getByRole('button', { name: 'Add list' }))

    await waitFor(() => expect(listsApi.createList).toHaveBeenCalled())
    const call = vi.mocked(listsApi.createList).mock.calls[0]?.[0]
    expect(call?.title).toBe('In review')
    // Fractional index: strictly after the last existing list.
    expect(call!.position > lists[1]!.position).toBe(true)
  })

  it('will not add a list with a blank title', async () => {
    setup()
    renderApp(path)
    await screen.findByRole('region', { name: 'To do' })

    await userEvent.click(screen.getByRole('button', { name: '+ Add a list' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add list' }))

    expect(await screen.findByText('Give the list a title')).toBeInTheDocument()
    expect(listsApi.createList).not.toHaveBeenCalled()
  })

  it('renames a list inline', async () => {
    setup()
    vi.mocked(listsApi.updateList).mockResolvedValue(makeList('a0', 'Backlog'))
    renderApp(path)
    await screen.findByRole('region', { name: 'To do' })

    await userEvent.click(screen.getByRole('button', { name: 'To do' }))
    const input = screen.getByLabelText('Rename To do')
    await userEvent.clear(input)
    await userEvent.type(input, 'Backlog{Enter}')

    await waitFor(() =>
      expect(listsApi.updateList).toHaveBeenCalledWith('a0', { title: 'Backlog' }),
    )
  })

  it('keeps a rename when focus moves away, rather than discarding it', async () => {
    setup()
    vi.mocked(listsApi.updateList).mockResolvedValue(makeList('a0', 'Backlog'))
    renderApp(path)
    await screen.findByRole('region', { name: 'To do' })

    await userEvent.click(screen.getByRole('button', { name: 'To do' }))
    const input = screen.getByLabelText('Rename To do')
    await userEvent.clear(input)
    await userEvent.type(input, 'Backlog')
    await userEvent.tab()

    await waitFor(() =>
      expect(listsApi.updateList).toHaveBeenCalledWith('a0', { title: 'Backlog' }),
    )
  })

  it('abandons a rename on Escape', async () => {
    setup()
    renderApp(path)
    await screen.findByRole('region', { name: 'To do' })

    await userEvent.click(screen.getByRole('button', { name: 'To do' }))
    await userEvent.type(screen.getByLabelText('Rename To do'), 'Something else{Escape}')

    expect(listsApi.updateList).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument()
  })

  it('archives a list', async () => {
    setup()
    vi.mocked(listsApi.updateList).mockResolvedValue(makeList('a0', 'To do', { archived: true }))
    renderApp(path)
    await screen.findByRole('region', { name: 'To do' })

    await userEvent.click(screen.getByRole('button', { name: 'Archive To do' }))

    await waitFor(() => expect(listsApi.updateList).toHaveBeenCalledWith('a0', { archived: true }))
  })

  describe('the archived list view', () => {
    it('offers restore and delete, so nothing is stranded there', async () => {
      setup({ archivedLists: [makeList('a9', 'Old list', { archived: true })] })
      renderApp(path)
      await screen.findByRole('region', { name: 'To do' })

      await userEvent.click(screen.getByRole('button', { name: 'Show archived lists' }))

      expect(await screen.findByRole('button', { name: 'Restore Old list' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Delete Old list permanently' }),
      ).toBeInTheDocument()
    })

    it('asks before deleting a list for good', async () => {
      setup({ archivedLists: [makeList('a9', 'Old list', { archived: true })] })
      vi.mocked(listsApi.deleteList).mockResolvedValue()
      renderApp(path)
      await screen.findByRole('region', { name: 'To do' })

      await userEvent.click(screen.getByRole('button', { name: 'Show archived lists' }))
      await userEvent.click(
        await screen.findByRole('button', { name: 'Delete Old list permanently' }),
      )

      expect(await screen.findByText('Delete Old list?')).toBeInTheDocument()
      expect(listsApi.deleteList).not.toHaveBeenCalled()

      const dialog = screen.getByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete list' }))

      await waitFor(() => expect(listsApi.deleteList).toHaveBeenCalledWith('a9'))
    })
  })

  describe('an archived board', () => {
    it('says so and offers no edits', async () => {
      setup({ board: makeBoard({ archived: true }) })
      renderApp(path)

      expect(await screen.findByText(/This board is archived/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '+ Add a list' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Archive To do' })).not.toBeInTheDocument()
    })
  })

  describe('settings', () => {
    it('lets an admin delete the board but hides that from a member', async () => {
      setup({ role: 'member' })
      renderApp(path)
      await screen.findByRole('region', { name: 'To do' })
      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByLabelText('Title')).toHaveValue('Roadmap')
      expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    })

    it('shows the delete button to an admin', async () => {
      setup({ role: 'admin' })
      renderApp(path)
      await screen.findByRole('region', { name: 'To do' })
      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('changes visibility through the RPC, not a plain update', async () => {
      setup({ role: 'admin' })
      vi.mocked(boardsApi.setBoardVisibility).mockResolvedValue(
        makeBoard({ visibility: 'private' }),
      )
      renderApp(path)
      await screen.findByRole('region', { name: 'To do' })
      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const dialog = await screen.findByRole('dialog')
      await userEvent.selectOptions(within(dialog).getByLabelText('Who can see it'), 'private')

      await waitFor(() =>
        expect(boardsApi.setBoardVisibility).toHaveBeenCalledWith(BOARD_ID, 'private'),
      )
      expect(boardsApi.updateBoard).not.toHaveBeenCalled()
    })
  })

  it('says nothing about a board it cannot load', async () => {
    vi.mocked(teamsApi.listMyTeams).mockResolvedValue([])
    vi.mocked(listsApi.listBoardLists).mockResolvedValue([])
    vi.mocked(boardsApi.getBoard).mockRejectedValue(new AppError('not-found', 'nope'))

    renderApp(path)

    expect(await screen.findByText('Board not found')).toBeInTheDocument()
    expect(screen.queryByText('Roadmap')).not.toBeInTheDocument()
  })
})
