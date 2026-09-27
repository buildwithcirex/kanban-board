import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import type { Board } from '@/lib/api/boards'
import type { BoardCard } from '@/lib/api/cards'
import type { List } from '@/lib/api/lists'
import type { Team, TeamRole } from '@/lib/api/teams'
import { renderApp } from '@/test/renderApp'
// Type-only, so they are erased before the hoisted vi.mock factories run.
import type * as BoardsApi from '@/lib/api/boards'
import type * as CardsApi from '@/lib/api/cards'
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

vi.mock('@/lib/api/cards', () => ({
  listBoardCards: vi.fn<typeof CardsApi.listBoardCards>(),
  createCard: vi.fn<typeof CardsApi.createCard>(),
  moveCard: vi.fn<typeof CardsApi.moveCard>(),
  updateCard: vi.fn<typeof CardsApi.updateCard>(),
  deleteCard: vi.fn<typeof CardsApi.deleteCard>(),
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

/**
 * The canvas is stubbed. ReactFlow needs a measured viewport, which jsdom does not provide, so
 * nothing would render inside it. Its own behaviour is covered by the pure layout tests in
 * features/board-canvas/layout.test.ts and by driving a real drag in a browser. What is worth
 * testing here is the wiring: what the page hands the canvas, and the controls around it.
 */
vi.mock('@/features/board-canvas/BoardCanvas', () => ({
  BoardCanvas: (props: Record<string, unknown>) => (
    <div
      data-testid="board-canvas"
      data-editable={String(props.editable)}
      data-lists={(props.lists as { title: string }[]).map((list) => list.title).join(',')}
      data-cards={(props.cards as { title: string }[]).map((card) => card.title).join(',')}
      data-mine-only={String((props.filter as { mineOnly: boolean }).mineOnly)}
      data-my-user={String(props.myUserId)}
    />
  ),
}))

const boardsApi = await import('@/lib/api/boards')
const cardsApi = await import('@/lib/api/cards')
const listsApi = await import('@/lib/api/lists')
const teamsApi = await import('@/lib/api/teams')

const TEAM_ID = 'team-1'
const BOARD_ID = 'board-1'
const ME = '00000000-0000-4000-8000-000000000001'
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

function makeCard(id: string, title: string, listId: string): BoardCard {
  return {
    id,
    board_id: BOARD_ID,
    list_id: listId,
    title,
    description: null,
    position: id,
    start_date: null,
    due_date: null,
    due_complete: false,
    priority: 'none',
    cover_color: null,
    archived: false,
    deleted_at: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    assigneeIds: [],
    labels: [],
  }
}

function setup({
  board = makeBoard(),
  lists = [makeList('a0', 'To do'), makeList('a1', 'Done')],
  archivedLists = [] as List[],
  cards = [makeCard('a0', 'Ship it', 'a0')],
  role = 'member' as TeamRole,
} = {}) {
  vi.mocked(boardsApi.getBoard).mockResolvedValue(board)
  vi.mocked(teamsApi.listMyTeams).mockResolvedValue([{ team, role }])
  vi.mocked(teamsApi.listTeamMembers).mockResolvedValue([])
  vi.mocked(boardsApi.listBoardMembers).mockResolvedValue([])
  vi.mocked(listsApi.listBoardLists).mockImplementation(async (_id, options) =>
    options?.archived ? archivedLists : lists,
  )
  vi.mocked(cardsApi.listBoardCards).mockResolvedValue(cards)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BoardPage', () => {
  it('hands the canvas the board lists and cards', async () => {
    setup()
    renderApp(path)

    const canvas = await screen.findByTestId('board-canvas')
    expect(canvas).toHaveAttribute('data-lists', 'To do,Done')
    expect(canvas).toHaveAttribute('data-cards', 'Ship it')
    expect(canvas).toHaveAttribute('data-my-user', ME)
  })

  it('uses the board title as the page title', async () => {
    setup()
    renderApp(path)
    await screen.findByTestId('board-canvas')
    await waitFor(() => expect(document.title).toBe('Roadmap · Kanban'))
  })

  it('toggles the my-cards filter', async () => {
    setup()
    renderApp(path)
    await screen.findByTestId('board-canvas')

    expect(screen.getByTestId('board-canvas')).toHaveAttribute('data-mine-only', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'My cards only' }))
    expect(screen.getByTestId('board-canvas')).toHaveAttribute('data-mine-only', 'true')
  })

  it('marks an archived board read-only rather than hiding it', async () => {
    setup({ board: makeBoard({ archived: true }) })
    renderApp(path)

    expect(await screen.findByText(/This board is archived/)).toBeInTheDocument()
    expect(screen.getByTestId('board-canvas')).toHaveAttribute('data-editable', 'false')
    expect(screen.queryByRole('button', { name: '+ Add a list' })).not.toBeInTheDocument()
  })

  it('adds a list at the end of the board', async () => {
    setup()
    vi.mocked(listsApi.createList).mockResolvedValue(makeList('a2', 'In review'))
    renderApp(path)
    await screen.findByTestId('board-canvas')

    await userEvent.click(screen.getByRole('button', { name: '+ Add a list' }))
    await userEvent.type(screen.getByLabelText('List title'), 'In review')
    await userEvent.click(screen.getByRole('button', { name: 'Add list' }))

    await waitFor(() => expect(listsApi.createList).toHaveBeenCalled())
    const call = vi.mocked(listsApi.createList).mock.calls[0]?.[0]
    expect(call?.title).toBe('In review')
    // A fractional index strictly after the last list.
    expect(call!.position > 'a1').toBe(true)
  })

  describe('the archived list view', () => {
    it('replaces the canvas and offers a way back', async () => {
      setup({ archivedLists: [makeList('a9', 'Old list', { archived: true })] })
      renderApp(path)
      await screen.findByTestId('board-canvas')

      await userEvent.click(screen.getByRole('button', { name: 'Archived lists' }))

      expect(await screen.findByRole('button', { name: 'Restore Old list' })).toBeInTheDocument()
      expect(screen.queryByTestId('board-canvas')).not.toBeInTheDocument()
    })
  })

  describe('settings', () => {
    it('hides delete from a plain member', async () => {
      setup({ role: 'member' })
      renderApp(path)
      await screen.findByTestId('board-canvas')
      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByLabelText('Title')).toHaveValue('Roadmap')
      expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    })

    it('changes visibility through the RPC, not a plain update', async () => {
      setup({ role: 'admin' })
      vi.mocked(boardsApi.setBoardVisibility).mockResolvedValue(
        makeBoard({ visibility: 'private' }),
      )
      renderApp(path)
      await screen.findByTestId('board-canvas')
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
    vi.mocked(cardsApi.listBoardCards).mockResolvedValue([])
    vi.mocked(boardsApi.getBoard).mockRejectedValue(new AppError('not-found', 'nope'))

    renderApp(path)

    expect(await screen.findByText('Board not found')).toBeInTheDocument()
    expect(screen.queryByText('Roadmap')).not.toBeInTheDocument()
  })
})
