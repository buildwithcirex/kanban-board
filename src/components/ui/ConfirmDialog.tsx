import { Button } from './Button'
import { Dialog } from './Dialog'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  /** Extra wording for an action that cannot be undone. */
  warning?: string
  destructive?: boolean
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

/** Confirmation step for anything irreversible: removing a member, deleting a team. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  warning,
  destructive = true,
  loading = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {warning && <p className="text-sm text-fg-muted">{warning}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  )
}
