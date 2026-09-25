import { useId, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type InputProps = ComponentProps<'input'> & {
  label: string
  hint?: string
  error?: string
  hideLabel?: boolean
}

export function Input({ label, hint, error, hideLabel, id, className, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn('text-sm font-medium text-fg', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-muted',
          'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none',
          error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/30',
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
