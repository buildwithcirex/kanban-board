import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

/** Last-resort boundary: never shows raw error details to the user. */
export function RouteErrorPage() {
  const error = useRouteError()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <EmptyState
        icon={<TriangleAlert />}
        title="Something went wrong"
        description="An unexpected error occurred. Reloading usually fixes it."
        action={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    </div>
  )
}
