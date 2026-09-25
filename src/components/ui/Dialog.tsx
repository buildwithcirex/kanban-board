import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Modal built on native <dialog>: focus trapping, Escape handling and focus
 * restoration come from the browser.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // Backdrop click is a mouse shortcut; Escape (onCancel) is the keyboard equivalent.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the <dialog> element itself is a click on the backdrop.
        if (event.target === event.currentTarget) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-surface p-0 text-fg shadow-xl backdrop:bg-black/40',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="text-sm text-fg-muted">
              {description}
            </p>
          )}
        </div>
        <IconButton label="Close" size="sm" icon={<X className="size-4" />} onClick={onClose} />
      </div>
      {children && <div className="px-5 py-4">{children}</div>}
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      )}
    </dialog>
  )
}
