import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { buttonBase } from './Button'

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** Required: icon-only buttons need an accessible name. */
  label: string
  icon: ReactNode
  size?: 'sm' | 'md'
}

export function IconButton({
  label,
  icon,
  size = 'md',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        buttonBase,
        'text-fg-muted hover:bg-surface-sunken hover:text-fg',
        // 44px hit area on touch devices; unchanged with a mouse.
        size === 'sm' ? 'size-8 pointer-coarse:size-11' : 'size-10 pointer-coarse:size-11',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}
