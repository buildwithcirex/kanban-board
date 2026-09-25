import { SquareKanban } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page } from '@/components/ui/Page'

export function BoardsPage() {
  return (
    <Page title="Boards" description="Boards from all the teams you belong to.">
      <EmptyState
        icon={<SquareKanban />}
        title="No boards yet"
        description="Boards belong to teams. Once you're in a team, its boards show up here."
      />
    </Page>
  )
}
