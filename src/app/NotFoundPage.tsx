import { Link } from 'react-router'
import { MapPinOff } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<MapPinOff />}
      title="Page not found"
      description="The page you're looking for doesn't exist or was moved."
      action={
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          Go to boards
        </Link>
      }
    />
  )
}
