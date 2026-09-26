import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Settings2, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { useSetPageTitle } from '@/app/pageTitle'
import { useAuth } from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/api/errors'
import type { TeamRole } from '@/lib/api/teams'
import { TeamMembers } from './TeamMembers'
import { TeamSettingsDialog } from './TeamSettingsDialog'
import { useDeleteTeam, useMyRole, useTeam } from './useTeams'

// Spelled out rather than assembled from an article and the role name: "a owner" is the kind of
// thing that slips through when the article is computed.
const rolePhrase: Record<TeamRole, string> = {
  owner: 'You own this team',
  admin: "You're an admin of this team",
  member: "You're a member of this team",
}

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const team = useTeam(teamId)
  const myRole = useMyRole(teamId)
  const deleteTeam = useDeleteTeam()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useSetPageTitle(team.data?.name)

  if (team.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner label="Loading team" className="size-6 text-fg-muted" />
      </div>
    )
  }

  // A team you cannot see and a team that does not exist are the same thing from here: RLS
  // returns nothing either way, and saying which would leak that the team exists.
  if (team.isError || !team.data) {
    return (
      <EmptyState
        icon={<Users />}
        title="Team not found"
        description="It may have been deleted, or you're no longer a member."
        action={
          <Button variant="primary" onClick={() => void navigate('/')}>
            Go to boards
          </Button>
        }
      />
    )
  }

  const canManage = myRole === 'owner' || myRole === 'admin'

  return (
    <Page
      title={team.data.name}
      description={team.data.description ?? undefined}
      actions={
        canManage && (
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={<Settings2 className="size-4" />}
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </Button>
            {myRole === 'owner' && (
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
        )
      }
    >
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: team.data.color }}
        />
        <span>{myRole ? rolePhrase[myRole] : 'You are not a member of this team'}</span>
      </div>

      <TeamMembers
        teamId={team.data.id}
        myRole={myRole}
        myUserId={user?.id ?? null}
        onLeft={() => void navigate('/')}
      />

      <TeamSettingsDialog
        team={team.data}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${team.data.name}?`}
        description="Every board, list and card in this team is deleted too."
        warning="This cannot be undone."
        confirmLabel="Delete team"
        loading={deleteTeam.isPending}
        error={deleteTeam.isError ? errorMessage(deleteTeam.error) : null}
        onConfirm={() =>
          deleteTeam.mutate(team.data.id, {
            onSuccess: () => {
              setDeleteOpen(false)
              void navigate('/')
            },
          })
        }
        onClose={() => {
          setDeleteOpen(false)
          deleteTeam.reset()
        }}
      />
    </Page>
  )
}
