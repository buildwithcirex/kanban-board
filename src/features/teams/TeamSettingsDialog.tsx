import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { errorMessage } from '@/lib/api/errors'
import type { Team } from '@/lib/api/teams'
import { ColorPicker } from './ColorPicker'
import { firstIssue, teamDescriptionSchema, teamNameSchema } from './teamSchema'
import { useUpdateTeam } from './useTeams'

type TeamSettingsDialogProps = {
  team: Team
  open: boolean
  onClose: () => void
}

/** Rename, re-describe or recolour a team. Owners and admins only, enforced by RLS. */
export function TeamSettingsDialog({ team, open, onClose }: TeamSettingsDialogProps) {
  const updateTeam = useUpdateTeam(team.id)
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description ?? '')
  const [color, setColor] = useState(team.color)
  const [error, setError] = useState<string | null>(null)
  const formId = 'team-settings-form'

  // Reopening after a cancelled edit should show the saved values, not the abandoned ones.
  useEffect(() => {
    if (open) {
      setName(team.name)
      setDescription(team.description ?? '')
      setColor(team.color)
      setError(null)
      updateTeam.reset()
    }
    // updateTeam.reset is stable; re-running on every render would clear the error immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, team.name, team.description, team.color])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const issue = firstIssue(teamNameSchema, name) ?? firstIssue(teamDescriptionSchema, description)
    setError(issue)
    if (issue) return

    updateTeam.mutate({ name, description, color }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Team settings"
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={updateTeam.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            form={formId}
            loading={updateTeam.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error ?? undefined}
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
        <ColorPicker legend="Colour" name="team-settings-color" value={color} onChange={setColor} />
        {updateTeam.isError && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(updateTeam.error)}
          </p>
        )}
      </form>
    </Dialog>
  )
}
