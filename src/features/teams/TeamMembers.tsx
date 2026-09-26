import { useState, type FormEvent } from 'react'
import { UserPlus, UserMinus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/api/errors'
import type { TeamMember, TeamRole } from '@/lib/api/teams'
import { firstIssue, memberEmailSchema } from './teamSchema'
import {
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamMemberRole,
  useTeamMembers,
} from './useTeams'

type TeamMembersProps = {
  teamId: string
  myRole: TeamRole | null
  myUserId: string | null
  /** Called after the signed-in user removes themselves from the team. */
  onLeft: () => void
}

const assignableRoles: Exclude<TeamRole, 'owner'>[] = ['admin', 'member']

function AddMemberForm({ teamId }: { teamId: string }) {
  const addMember = useAddTeamMember(teamId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('member')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const issue = firstIssue(memberEmailSchema, email)
    setEmailError(issue)
    setAdded(null)
    if (issue) return

    addMember.mutate(
      { email, role },
      {
        onSuccess: () => {
          setAdded(email.trim())
          setEmail('')
        },
      },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      noValidate
    >
      <div className="flex-1">
        <Input
          label="Add by email"
          type="email"
          placeholder="teammate@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setEmailError(null)
          }}
          error={emailError ?? (addMember.isError ? errorMessage(addMember.error) : undefined)}
          hint={added ? `${added} was added to the team.` : undefined}
          autoComplete="off"
          maxLength={320}
          required
        />
      </div>
      <Select
        label="Role"
        value={role}
        onChange={(event) => setRole(event.target.value as Exclude<TeamRole, 'owner'>)}
        className="sm:w-32"
      >
        {assignableRoles.map((value) => (
          <option key={value} value={value}>
            {value === 'admin' ? 'Admin' : 'Member'}
          </option>
        ))}
      </Select>
      <Button
        type="submit"
        variant="primary"
        icon={<UserPlus className="size-4" />}
        loading={addMember.isPending}
        className="sm:mt-6"
      >
        Add
      </Button>
    </form>
  )
}

function MemberRow({
  member,
  teamId,
  isMe,
  canManage,
  onRequestRemove,
}: {
  member: TeamMember
  teamId: string
  isMe: boolean
  canManage: boolean
  onRequestRemove: (member: TeamMember) => void
}) {
  const setRole = useSetTeamMemberRole(teamId)
  const isOwner = member.role === 'owner'
  // The owner's row is fixed: their role cannot change and they cannot be removed.
  const canEditRole = canManage && !isOwner
  const canRemove = !isOwner && (canManage || isMe)

  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar name={member.name} color={member.color} src={member.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">
          {member.name}
          {isMe && <span className="ml-2 text-xs font-normal text-fg-muted">You</span>}
        </p>
        <p className="truncate text-xs text-fg-muted">{member.email}</p>
      </div>

      {canEditRole ? (
        <Select
          label={`Role for ${member.name}`}
          hideLabel
          value={member.role}
          disabled={setRole.isPending}
          onChange={(event) =>
            setRole.mutate({
              userId: member.userId,
              role: event.target.value as Exclude<TeamRole, 'owner'>,
            })
          }
          className="h-8 w-28 text-xs pointer-coarse:h-11"
        >
          {assignableRoles.map((value) => (
            <option key={value} value={value}>
              {value === 'admin' ? 'Admin' : 'Member'}
            </option>
          ))}
        </Select>
      ) : (
        <span className="text-xs text-fg-muted capitalize">{member.role}</span>
      )}

      {canRemove ? (
        <IconButton
          size="sm"
          label={isMe ? 'Leave this team' : `Remove ${member.name}`}
          icon={<UserMinus className="size-4" />}
          className="hover:bg-danger-soft hover:text-danger"
          onClick={() => onRequestRemove(member)}
        />
      ) : (
        <span className="size-8" aria-hidden />
      )}
    </li>
  )
}

export function TeamMembers({ teamId, myRole, myUserId, onLeft }: TeamMembersProps) {
  const members = useTeamMembers(teamId)
  const removeMember = useRemoveTeamMember(teamId)
  const [pendingRemoval, setPendingRemoval] = useState<TeamMember | null>(null)

  const canManage = myRole === 'owner' || myRole === 'admin'
  const removingSelf = pendingRemoval?.userId === myUserId

  function confirmRemoval() {
    if (!pendingRemoval) return
    removeMember.mutate(pendingRemoval.userId, {
      onSuccess: () => {
        const wasMe = pendingRemoval.userId === myUserId
        setPendingRemoval(null)
        if (wasMe) onLeft()
      },
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Members</h3>
        {members.data && (
          <span className="text-xs text-fg-muted">
            {members.data.length} {members.data.length === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>

      {canManage && <AddMemberForm teamId={teamId} />}

      {members.isPending && (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner label="Loading members" /> Loading members…
        </p>
      )}

      {members.isError && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(members.error)}
        </p>
      )}

      {members.data && (
        <ul className="divide-y divide-border">
          {members.data.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              teamId={teamId}
              isMe={member.userId === myUserId}
              canManage={canManage}
              onRequestRemove={setPendingRemoval}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={removingSelf ? 'Leave this team?' : `Remove ${pendingRemoval?.name ?? ''}?`}
        description={
          removingSelf
            ? "You'll lose access to this team's boards."
            : `They'll lose access to this team's boards. Cards assigned to them stay put.`
        }
        confirmLabel={removingSelf ? 'Leave team' : 'Remove'}
        loading={removeMember.isPending}
        error={removeMember.isError ? errorMessage(removeMember.error) : null}
        onConfirm={confirmRemoval}
        onClose={() => {
          setPendingRemoval(null)
          removeMember.reset()
        }}
      />
    </section>
  )
}
