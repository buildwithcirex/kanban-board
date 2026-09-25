import { Bell } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'

export function NotificationsPage() {
  return (
    <Page title="Notifications">
      <EmptyState
        icon={<Bell />}
        title="You're all caught up"
        description="Assignments, mentions and due-date reminders will appear here."
      />
    </Page>
  )
}
