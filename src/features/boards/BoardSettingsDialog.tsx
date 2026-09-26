import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ImageUp, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useTeamMembers } from '@/features/teams/useTeams'
import { firstIssue } from '@/features/teams/teamSchema'
import {
  deleteBoardBackground,
  parseBackground,
  serializeBackground,
  uploadBoardBackground,
  type Board,
  type BoardVisibility,
} from '@/lib/api/boards'
import { errorMessage } from '@/lib/api/errors'
import { BackgroundSwatches } from './BackgroundSwatches'
import { backgroundFileIssue, boardTitleSchema } from './boardSchema'
import {
  useAddBoardMember,
  useBoardMembers,
  useDeleteBoard,
  useRemoveBoardMember,
  useSetBoardVisibility,
  useUpdateBoard,
} from './useBoards'

type BoardSettingsDialogProps = {
  board: Board
  open: boolean
  onClose: () => void
  /** True when the signed-in user is an owner or admin of the board's team. */
  canDelete: boolean
}

/** Who can open a private board. Only people already in the team can be added. */
function PrivateMembers({ board }: { board: Board }) {
  const members = useBoardMembers(board.id)
  const teamMembers = useTeamMembers(board.team_id)
  const addMember = useAddBoardMember(board.id)
  const removeMember = useRemoveBoardMember(board.id)
  const [picked, setPicked] = useState('')

  const onBoard = new Set((members.data ?? []).map((member) => member.userId))
  const candidates = (teamMembers.data ?? []).filter((member) => !onBoard.has(member.userId))

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-fg">Who can open it</h3>
        {members.data && <span className="text-xs text-fg-muted">{members.data.length}</span>}
      </div>

      {members.isPending && (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner label="Loading board members" /> Loading…
        </p>
      )}

      {members.data && members.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {members.data.map((member) => (
            <li key={member.userId} className="flex items-center gap-2">
              <Avatar name={member.name} color={member.color} src={member.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{member.name}</span>
              <IconButton
                size="sm"
                label={`Remove ${member.name} from this board`}
                icon={<Trash2 className="size-4" />}
                className="hover:bg-danger-soft hover:text-danger"
                onClick={() => removeMember.mutate(member.userId)}
              />
            </li>
          ))}
        </ul>
      )}

      {candidates.length > 0 ? (
        <div className="flex items-end gap-2">
          <Select
            label="Add someone from the team"
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
            className="flex-1"
          >
            <option value="">Choose a teammate…</option>
            {candidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={!picked}
            loading={addMember.isPending}
            onClick={() => {
              addMember.mutate(picked, { onSuccess: () => setPicked('') })
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <p className="text-xs text-fg-muted">Everyone in the team is already on this board.</p>
      )}

      {(addMember.isError || removeMember.isError) && (
        <p role="alert" className="text-xs text-danger">
          {errorMessage(addMember.error ?? removeMember.error)}
        </p>
      )}
    </div>
  )
}

export function BoardSettingsDialog({ board, open, onClose, canDelete }: BoardSettingsDialogProps) {
  const navigate = useNavigate()
  const updateBoard = useUpdateBoard(board.id, board.team_id)
  const setVisibility = useSetBoardVisibility(board.id, board.team_id)
  const deleteBoard = useDeleteBoard(board.team_id)
  const fileInput = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(board.title)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const formId = 'board-settings-form'

  const background = parseBackground(board.background)

  useEffect(() => {
    if (open) {
      setTitle(board.title)
      setTitleError(null)
      setUploadError(null)
      updateBoard.reset()
    }
    // Resetting whenever the mutation object changes would wipe the error the moment it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, board.title])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const issue = firstIssue(boardTitleSchema, title)
    setTitleError(issue)
    if (issue) return
    updateBoard.mutate({ title }, { onSuccess: onClose })
  }

  function pickColor(color: string) {
    const previous = background
    updateBoard.mutate(
      { background: serializeBackground({ kind: 'color', color }) },
      {
        onSuccess: () => {
          // The old image is now unreachable from any board, so don't leave it in the bucket.
          if (previous.kind === 'image') void deleteBoardBackground(previous.path).catch(() => {})
        },
      },
    )
  }

  async function handleUpload(file: File) {
    const issue = backgroundFileIssue(file)
    setUploadError(issue)
    if (issue) return

    const previous = background
    setUploading(true)
    try {
      const path = await uploadBoardBackground(board.id, file)
      updateBoard.mutate(
        { background: serializeBackground({ kind: 'image', path }) },
        {
          onSuccess: () => {
            if (previous.kind === 'image') void deleteBoardBackground(previous.path).catch(() => {})
          },
        },
      )
    } catch (error) {
      setUploadError(errorMessage(error))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Board settings"
        className="max-w-lg"
        footer={
          <>
            <Button size="sm" onClick={onClose} disabled={updateBoard.isPending}>
              Close
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              form={formId}
              loading={updateBoard.isPending}
            >
              Save title
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <form id={formId} onSubmit={handleSubmit} noValidate>
            <Input
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={titleError ?? undefined}
              maxLength={120}
              autoComplete="off"
              required
            />
          </form>

          <div className="flex flex-col gap-2">
            <BackgroundSwatches
              legend="Background"
              name="board-background"
              value={background.kind === 'color' ? background.color : null}
              onChange={pickColor}
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleUpload(file)
                }}
              />
              <Button
                size="sm"
                icon={<ImageUp className="size-4" />}
                loading={uploading}
                onClick={() => fileInput.current?.click()}
              >
                Upload an image
              </Button>
              {background.kind !== 'none' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const previous = background
                    updateBoard.mutate(
                      { background: null },
                      {
                        onSuccess: () => {
                          if (previous.kind === 'image') {
                            void deleteBoardBackground(previous.path).catch(() => {})
                          }
                        },
                      },
                    )
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-fg-muted">JPEG, PNG, WebP or AVIF, up to 5 MB.</p>
            {uploadError && (
              <p role="alert" className="text-xs text-danger">
                {uploadError}
              </p>
            )}
          </div>

          <Select
            label="Who can see it"
            value={board.visibility}
            disabled={setVisibility.isPending}
            onChange={(event) => setVisibility.mutate(event.target.value as BoardVisibility)}
            hint={
              board.visibility === 'team'
                ? 'Everyone in the team can open this board.'
                : 'Only the people listed below can open this board.'
            }
          >
            <option value="team">The whole team</option>
            <option value="private">Just the people I add</option>
          </Select>

          {board.visibility === 'private' && <PrivateMembers board={board} />}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={updateBoard.isPending}
                onClick={() =>
                  updateBoard.mutate(
                    { archived: !board.archived },
                    { onSuccess: board.archived ? undefined : onClose },
                  )
                }
              >
                {board.archived ? 'Restore board' : 'Archive board'}
              </Button>
              {canDelete && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )}
            </div>
            <p className="text-xs text-fg-muted">Archiving is reversible. Deleting is not.</p>
          </div>

          {(updateBoard.isError || setVisibility.isError) && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(updateBoard.error ?? setVisibility.error)}
            </p>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${board.title}?`}
        description="Every list and card on this board is deleted too."
        warning="This cannot be undone. Archive it instead if you might want it back."
        confirmLabel="Delete board"
        loading={deleteBoard.isPending}
        error={deleteBoard.isError ? errorMessage(deleteBoard.error) : null}
        onConfirm={() =>
          deleteBoard.mutate(board.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
              void navigate(`/t/${board.team_id}`)
            },
          })
        }
        onClose={() => {
          setConfirmDelete(false)
          deleteBoard.reset()
        }}
      />
    </>
  )
}
