import type { ReactNode } from 'react'

type PageProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

/** Standard page body: heading row plus content, width-constrained. */
export function Page({ title, description, actions, children }: PageProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-fg-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}
