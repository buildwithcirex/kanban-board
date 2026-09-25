import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent [&>svg]:size-6">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {description && <p className="text-sm text-fg-muted">{description}</p>}
      {action}
    </div>
  )
}
