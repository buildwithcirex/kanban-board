import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type SpinnerProps = {
  className?: string
  /** Accessible label; omit when the spinner is decorative (e.g. inside a busy button). */
  label?: string
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <LoaderCircle
      className={cn('size-4 animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
