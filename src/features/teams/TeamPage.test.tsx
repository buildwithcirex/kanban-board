import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import type { Team, TeamMember, TeamRole } from '@/lib/api/teams'
import { renderApp } from '@/test/renderApp'
// Type-only, so it is erased before the hoisted vi.mock factory runs.
import type * as TeamsApi from '@/lib/api/teams'

/**
 * The team page decides what an owner, an admin and a member are each allowed to see. The
 * database enforces the same rules (tests/rls/team-members.test.ts) — these tests are about the
 * interface not offering an action the server would refuse, and not hiding one it would allow.
 */

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

// Matches the signed-in user that renderApp stubs.
const ME = '00000000-0000-4000-8000-000000000001'
const TEAM_ID = 'team-1'

const team: Team = {
  id: TEAM_ID,
  name: 'Product',
  description: 'Everything we are shipping this quarter.',
  color: '#4b7bec',
  created_by: ME,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function member(overrides: Partial<TeamMember> & Pick<TeamMember, 'userId' | 'name'>): TeamMember {
  return {
    role: 'member',
    email: `${overrides.name.split(' ')[0]?.toLowerCase()}@kanban.test`,
    avatarUrl: null,
    color: '#4b7bec',
    ...overrides,
  }
}

const owner = member({ userId: 'owner-id', name: 'Ada Lovelace', role: 'owner' })
const admin = member({ userId: 'admin-id', name: 'Grace Hopper', role: 'admin' })
const plain = member({ userId: 'member-id', name: 'Linus Torvalds', role: 'member' })

/**
 * Signs the stubbed user in as `myRole` and puts them in the member list *instead of* the fixture
 * person who holds that role, so a team never ends up with, say, two owners.
 */
function setup(myRole: TeamRole) {
  const me = member({ userId: ME, name: 'Testy McTest', role: myRole })
  const others = [owner, admin, plain].filter((other) => other.role !== myRole)

  vi.mocked(api.getTeam).mockResolvedValue(team)
  vi.mocked(api.listMyTeams).mockResolvedValue([{ team, role: myRole }])
  vi.mocked(api.listTeamMembers).mockResolvedValue(
    [me, ...others].sort((a, b) => a.name.localeCompare(b.name)),
  )
  return me
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TeamPage', () => {
  it('shows the team and its members', async () => {
    setup('member')
    renderApp(`/t/${TEAM_ID}`)

    expect(await screen.findByRole('heading', { name: 'Product' })).toBeInTheDocument()
    // The settings dialog holds the same text in a textarea, so match the paragraph specifically.
    expect(
      screen.getByText('Everything we are shipping this quarter.', { selector: 'p' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    // setup() puts the signed-in user in place of the seeded person with that role.
    expect(screen.getByText('3 people')).toBeInTheDocument()
  })

  it('uses the team name as the page title', async () => {
    setup('member')
    renderApp(`/t/${TEAM_ID}`)

    await screen.findByRole('heading', { name: 'Product' })
    await waitFor(() => expect(document.title).toBe('Product · Kanban'))
  })

  it('tells you your own role', async () => {
    setup('admin')
    renderApp(`/t/${TEAM_ID}`)
    expect(await screen.findByText("You're an admin of this team")).toBeInTheDocument()
  })

  describe('as a plain member', () => {
    it('offers no way to add, promote or remove anyone else', async () => {
      setup('member')
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await screen.findByText('Ada Lovelace')
      expect(screen.queryByLabelText('Add by email')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Role for Ada Lovelace')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove Ada Lovelace' })).not.toBeInTheDocument()
    })

    it('still lets you leave the team yourself', async () => {
      setup('member')
      renderApp(`/t/${TEAM_ID}`)
      expect(await screen.findByRole('button', { name: 'Leave this team' })).toBeInTheDocument()
    })
  })

  describe('as an admin', () => {
    it('can manage members but cannot delete the team', async () => {
      setup('admin')
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      expect(screen.getByLabelText('Add by email')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    })

    it('leaves the owner alone: no role control, no remove button', async () => {
      setup('admin')
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await screen.findByText('Linus Torvalds')
      expect(screen.queryByLabelText('Role for Ada Lovelace')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove Ada Lovelace' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('Role for Linus Torvalds')).toBeInTheDocument()
    })

    it('sends the typed email and the chosen role', async () => {
      setup('admin')
      vi.mocked(api.addTeamMember).mockResolvedValue()
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await userEvent.type(screen.getByLabelText('Add by email'), 'new@kanban.test')
      await userEvent.selectOptions(screen.getByLabelText('Role'), 'admin')
      await userEvent.click(screen.getByRole('button', { name: 'Add' }))

      await waitFor(() =>
        expect(api.addTeamMember).toHaveBeenCalledWith({
          teamId: TEAM_ID,
          email: 'new@kanban.test',
          role: 'admin',
        }),
      )
      expect(await screen.findByText('new@kanban.test was added to the team.')).toBeInTheDocument()
    })

    it('rejects a malformed address without calling the server', async () => {
      setup('admin')
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await userEvent.type(screen.getByLabelText('Add by email'), 'not-an-email')
      await userEvent.click(screen.getByRole('button', { name: 'Add' }))

      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
      expect(api.addTeamMember).not.toHaveBeenCalled()
    })

    it("shows the server's reason when the address has no account", async () => {
      setup('admin')
      vi.mocked(api.addTeamMember).mockRejectedValue(
        new AppError('not-found', 'No account uses that email address yet.'),
      )
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await userEvent.type(screen.getByLabelText('Add by email'), 'nobody@kanban.test')
      await userEvent.click(screen.getByRole('button', { name: 'Add' }))

      expect(await screen.findByText('No account uses that email address yet.')).toBeInTheDocument()
    })

    it('changes a role through the dropdown', async () => {
      setup('admin')
      vi.mocked(api.setTeamMemberRole).mockResolvedValue()
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await screen.findByText('Linus Torvalds')
      await userEvent.selectOptions(screen.getByLabelText('Role for Linus Torvalds'), 'admin')

      await waitFor(() =>
        expect(api.setTeamMemberRole).toHaveBeenCalledWith({
          teamId: TEAM_ID,
          userId: plain.userId,
          role: 'admin',
        }),
      )
    })

    it('asks before removing someone', async () => {
      setup('admin')
      vi.mocked(api.removeTeamMember).mockResolvedValue()
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await screen.findByText('Linus Torvalds')
      await userEvent.click(screen.getByRole('button', { name: 'Remove Linus Torvalds' }))
      expect(await screen.findByText('Remove Linus Torvalds?')).toBeInTheDocument()
      expect(api.removeTeamMember).not.toHaveBeenCalled()

      const dialog = screen.getByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

      await waitFor(() => expect(api.removeTeamMember).toHaveBeenCalledWith(TEAM_ID, plain.userId))
    })
  })

  describe('as the owner', () => {
    it('can delete the team, after confirming', async () => {
      setup('owner')
      vi.mocked(api.deleteTeam).mockResolvedValue()
      const router = renderApp(`/t/${TEAM_ID}`)
      await screen.findByRole('heading', { name: 'Product' })

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('Delete Product?')).toBeInTheDocument()
      expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
      expect(api.deleteTeam).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Delete team' }))

      await waitFor(() => expect(api.deleteTeam).toHaveBeenCalledWith(TEAM_ID))
      await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    })

    it('cannot leave their own team', async () => {
      setup('owner')
      renderApp(`/t/${TEAM_ID}`)
      await screen.findByText('Linus Torvalds')
      expect(screen.queryByRole('button', { name: 'Leave this team' })).not.toBeInTheDocument()
    })
  })

  it('says nothing about a team it cannot load', async () => {
    vi.mocked(api.listMyTeams).mockResolvedValue([])
    vi.mocked(api.listTeamMembers).mockResolvedValue([])
    vi.mocked(api.getTeam).mockRejectedValue(new AppError('not-found', 'nope'))

    renderApp(`/t/${TEAM_ID}`)

    // Deleted and "not yours" look identical on purpose; saying which would confirm it exists.
    expect(await screen.findByText('Team not found')).toBeInTheDocument()
    expect(screen.queryByText('Product')).not.toBeInTheDocument()
  })
})
