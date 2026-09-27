import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

type SheetProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Sits under the title, e.g. which list the card is in. */
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/**
 * A panel that fills the screen on a phone and floats as a dialog from `sm` up.
 *
 * Built on `<dialog>` so focus trapping, Escape and focus restoration come from the browser
 * rather than being reimplemented. On a phone it is the whole viewport — there is no room for a
 * card's worth of fields in a floating box, and a full screen is what Trello does there too.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // A full-screen panel must not let the page behind it scroll under the finger.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    // Backdrop click is a mouse shortcut; Escape (onCancel) is the keyboard equivalent.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={cn(
        'max-h-none max-w-none border-border bg-surface p-0 text-fg backdrop:bg-black/50',
        // Phone: the whole viewport, respecting the notch and the home indicator.
        'm-0 h-dvh w-screen',
        // From `sm`: a centred panel with room to breathe.
        'sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:w-[calc(100%-3rem)] sm:max-w-2xl sm:rounded-xl sm:border sm:shadow-2xl',
      )}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold break-words">
                {title}
              </h2>
              {subtitle && <div className="mt-0.5 text-xs text-fg-muted">{subtitle}</div>}
            </div>
            <IconButton label="Close" icon={<X className="size-5" />} onClick={onClose} />
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {children}
          </div>

          {footer && (
            <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}
