import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import type { Team } from '@/lib/api/teams'
import { renderApp } from '@/test/renderApp'
// Type-only, so it is erased before the hoisted vi.mock factory runs.
import type * as TeamsApi from '@/lib/api/teams'

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

const api = await import('@/lib/api/teams')

function makeTeam(id: string, name: string): Team {
  return {
    id,
    name,
    description: null,
    color: '#4b7bec',
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function sidebar() {
  return screen.getByRole('complementary', { hidden: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listTeamMembers).mockResolvedValue([])
})

describe('TeamNav', () => {
  it('lists your teams with your role, each linking to its page', async () => {
    vi.mocked(api.listMyTeams).mockResolvedValue([
      { team: makeTeam('team-1', 'Product'), role: 'owner' },
      { team: makeTeam('team-2', 'Growth'), role: 'member' },
    ])

    renderApp('/')

    // The section renders before the query resolves, so wait for a link, not the section.
    const product = await screen.findByRole('link', { name: /Product/ })
    expect(product).toHaveAttribute('href', '/t/team-1')

    const nav = screen.getByRole('region', { name: 'Your teams' })
    expect(within(nav).getByRole('link', { name: /Growth/ })).toHaveAttribute('href', '/t/team-2')
    expect(within(nav).getByText('owner')).toBeInTheDocument()
  })

  it('says so when you are in no teams yet', async () => {
    vi.mocked(api.listMyTeams).mockResolvedValue([])
    renderApp('/')
    expect(await screen.findByText('No teams yet')).toBeInTheDocument()
  })

  it('reports a failure to load rather than showing an empty list', async () => {
    vi.mocked(api.listMyTeams).mockRejectedValue(new AppError('unknown', 'boom'))
    renderApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load teams")
    expect(screen.queryByText('No teams yet')).not.toBeInTheDocument()
  })
})

describe('CreateTeamDialog', () => {
  beforeEach(() => {
    vi.mocked(api.listMyTeams).mockResolvedValue([])
  })

  async function openDialog() {
    renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: 'New team' }))
    return screen.getByRole('dialog')
  }

  it('will not submit an empty name, and does not call the server', async () => {
    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    expect(await screen.findByText('Give the team a name')).toBeInTheDocument()
    expect(api.createTeam).not.toHaveBeenCalled()
  })

  it('creates the team and opens it', async () => {
    vi.mocked(api.createTeam).mockResolvedValue(makeTeam('team-9', 'Growth'))
    vi.mocked(api.getTeam).mockResolvedValue(makeTeam('team-9', 'Growth'))

    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Growth')
    await userEvent.type(within(dialog).getByLabelText('Description'), 'Acquisition work')
    await userEvent.click(within(dialog).getByRole('radio', { name: '#20bf6b' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    await waitFor(() =>
      expect(api.createTeam).toHaveBeenCalledWith({
        name: 'Growth',
        description: 'Acquisition work',
        color: '#20bf6b',
      }),
    )
    await screen.findByRole('heading', { name: 'Growth' })
  })

  it('keeps the dialog open and explains when the server refuses', async () => {
    vi.mocked(api.createTeam).mockRejectedValue(
      new AppError('conflict', 'Someone changed this first. Refresh and try again.'),
    )

    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Growth')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    expect(
      await within(dialog).findByText('Someone changed this first. Refresh and try again.'),
    ).toBeInTheDocument()
    expect(dialog).toBeVisible()
  })

  it('forgets an abandoned draft', async () => {
    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Discarded')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await userEvent.click(screen.getByRole('button', { name: 'New team' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Name')).toHaveValue('')
  })
})

describe('TeamsPage', () => {
  it('lists your teams as links, which is how phones reach them at all', async () => {
    // The sidebar switcher is hidden below `md`, so this page is the only route to a team there.
    vi.mocked(api.listMyTeams).mockResolvedValue([
      { team: makeTeam('team-1', 'Product'), role: 'admin' },
    ])

    renderApp('/teams')

    // The sidebar switcher lists the same team, so scope to the page body.
    const main = screen.getByRole('main')
    const card = await within(main).findByRole('link', { name: /Product/ })
    expect(card).toHaveAttribute('href', '/t/team-1')
    expect(within(card).getByText('admin')).toBeInTheDocument()
  })

  it('invites you to create one when you have none', async () => {
    vi.mocked(api.listMyTeams).mockResolvedValue([])
    renderApp('/teams')

    expect(await screen.findByText("You're not in a team yet")).toBeInTheDocument()
    // Two entry points on this route: the sidebar icon button and the empty state.
    expect(screen.getAllByRole('button', { name: 'New team' }).length).toBeGreaterThan(0)
  })

  it('reports a failure instead of pretending you have no teams', async () => {
    vi.mocked(api.listMyTeams).mockRejectedValue(
      new AppError('unknown', 'Something went wrong. Please try again.'),
    )
    renderApp('/teams')

    const main = screen.getByRole('main')
    expect(await within(main).findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
    expect(screen.queryByText("You're not in a team yet")).not.toBeInTheDocument()
  })
})

describe('the sidebar', () => {
  it('does not offer team actions before you are signed in', async () => {
    vi.mocked(api.listMyTeams).mockResolvedValue([])
    renderApp('/', { status: 'signed-out' })

    expect(await screen.findByText('Sign in to see your teams')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New team' })).not.toBeInTheDocument()
    expect(within(sidebar()).queryByRole('link', { name: /\/t\// })).not.toBeInTheDocument()
    expect(api.listMyTeams).not.toHaveBeenCalled()
  })
})
