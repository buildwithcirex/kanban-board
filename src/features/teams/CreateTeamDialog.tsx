import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { errorMessage } from '@/lib/api/errors'
import { ColorPicker } from './ColorPicker'
import { firstIssue, teamColors, teamDescriptionSchema, teamNameSchema } from './teamSchema'
import { useCreateTeam } from './useTeams'

type CreateTeamDialogProps = {
  open: boolean
  onClose: () => void
}

/** Creating a team makes you its owner; the `create_team` RPC does both writes at once. */
export function CreateTeamDialog({ open, onClose }: CreateTeamDialogProps) {
  const navigate = useNavigate()
  const createTeam = useCreateTeam()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(teamColors[0])
  const [nameError, setNameError] = useState<string | null>(null)
  const formId = 'create-team-form'

  function reset() {
    setName('')
    setDescription('')
    setColor(teamColors[0])
    setNameError(null)
    createTeam.reset()
  }

  function close() {
    reset()
    onClose()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const issue = firstIssue(teamNameSchema, name) ?? firstIssue(teamDescriptionSchema, description)
    setNameError(issue)
    if (issue) return

    createTeam.mutate(
      { name, description, color },
      {
        onSuccess: (team) => {
          reset()
          onClose()
          void navigate(`/t/${team.id}`)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New team"
      description="Teams own boards. Everyone you add can see the team's boards."
      footer={
        <>
          <Button size="sm" onClick={close} disabled={createTeam.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            form={formId}
            loading={createTeam.isPending}
          >
            Create team
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError ?? undefined}
          maxLength={80}
          autoComplete="off"
          required
        />
        <Textarea
          label="Description"
          hint="Optional."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />
        <ColorPicker legend="Colour" name="team-color" value={color} onChange={setColor} />
        {createTeam.isError && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(createTeam.error)}
          </p>
        )}
      </form>
    </Dialog>
  )
}
