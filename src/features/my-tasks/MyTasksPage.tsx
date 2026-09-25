import { ListTodo } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'

export function MyTasksPage() {
  return (
    <Page title="My Tasks" description="Cards assigned to you across every team.">
      <EmptyState
        icon={<ListTodo />}
        title="Nothing assigned to you"
        description="When a teammate assigns you a card, it appears here grouped by due date."
      />
    </Page>
  )
}
