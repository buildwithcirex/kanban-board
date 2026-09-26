import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { errorMessage } from '@/lib/api/errors'
import { serializeBackground, type Board, type BoardVisibility } from '@/lib/api/boards'
import { positionAtEnd } from '@/lib/ordering'
import { firstIssue } from '@/features/teams/teamSchema'
import { BackgroundSwatches } from './BackgroundSwatches'
import { boardColors, boardTitleSchema } from './boardSchema'
import { useCreateBoard, useTeamBoards } from './useBoards'

type CreateBoardDialogProps = {
  teamId: string
  open: boolean
  onClose: () => void
  /** Defaults to opening the new board. */
  onCreated?: (board: Board) => void
}

export function CreateBoardDialog({ teamId, open, onClose, onCreated }: CreateBoardDialogProps) {
  const navigate = useNavigate()
  const boards = useTeamBoards(teamId)
  const createBoard = useCreateBoard(teamId)
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<string>(boardColors[0])
  const [visibility, setVisibility] = useState<BoardVisibility>('team')
  const [titleError, setTitleError] = useState<string | null>(null)
  const formId = 'create-board-form'

  function reset() {
    setTitle('')
    setColor(boardColors[0])
    setVisibility('team')
    setTitleError(null)
    createBoard.reset()
  }

  function close() {
    reset()
    onClose()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const issue = firstIssue(boardTitleSchema, title)
    setTitleError(issue)
    if (issue) return

    createBoard.mutate(
      {
        title,
        // New boards go on the end, so an existing board never has to be renumbered.
        position: positionAtEnd(boards.data ?? []),
        visibility,
        background: serializeBackground({ kind: 'color', color }),
      },
      {
        onSuccess: (board) => {
          reset()
          onClose()
          if (onCreated) onCreated(board)
          else void navigate(`/t/${board.team_id}/b/${board.id}`)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New board"
      description="Boards hold lists and cards. It starts with To do, In progress and Done."
      footer={
        <>
          <Button size="sm" onClick={close} disabled={createBoard.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            form={formId}
            loading={createBoard.isPending}
          >
            Create board
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={titleError ?? undefined}
          maxLength={120}
          autoComplete="off"
          required
        />
        <BackgroundSwatches
          legend="Background"
          name="new-board-background"
          value={color}
          onChange={setColor}
        />
        <Select
          label="Who can see it"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as BoardVisibility)}
          hint={
            visibility === 'team'
              ? 'Everyone in the team.'
              : 'Only people you add to the board. You can add them after it exists.'
          }
        >
          <option value="team">The whole team</option>
          <option value="private">Just the people I add</option>
        </Select>
        {createBoard.isError && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(createBoard.error)}
          </p>
        )}
      </form>
    </Dialog>
  )
}
