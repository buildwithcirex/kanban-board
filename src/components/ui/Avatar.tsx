import { cn } from '@/lib/cn'
import { initials } from '@/lib/initials'

type AvatarProps = {
  name: string
  /** Profile colour (hex). Used as the fallback background. */
  color?: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'size-6 text-[0.625rem]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const

/**
 * Decorative by default: the person's name is always written next to it, so repeating it here
 * would make screen readers say it twice.
 */
export function Avatar({ name, color, src, size = 'md', className }: AvatarProps) {
  const classes = cn(
    'flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
    sizeClasses[size],
    className,
  )

  if (src) {
    return <img src={src} alt="" aria-hidden className={cn(classes, 'object-cover')} />
  }

  return (
    <span aria-hidden className={cn(classes, 'text-white')} style={{ backgroundColor: color }}>
      {initials(name)}
    </span>
  )
}
