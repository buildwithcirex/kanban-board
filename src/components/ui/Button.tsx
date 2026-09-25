import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface text-fg hover:bg-surface-sunken',
  ghost: 'text-fg hover:bg-surface-sunken',
  danger: 'bg-danger text-white hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-sm',
  md: 'h-10 gap-2 px-3.5 text-sm',
}

export const buttonBase =
  'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50'

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonBase, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}
