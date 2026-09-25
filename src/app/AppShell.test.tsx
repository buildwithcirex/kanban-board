import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '@/lib/queryClient'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('AppShell', () => {
  it('renders the boards page by default and sets the document title', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Boards' })).toBeInTheDocument()
    expect(document.title).toBe('Boards · Kanban')
  })

  it('navigates between sections and marks the active link', async () => {
    const router = renderAt('/')
    const [sidebarNav] = screen.getAllByRole('navigation', { name: 'Main' })
    await userEvent.click(within(sidebarNav!).getByRole('link', { name: 'My Tasks' }))
    expect(router.state.location.pathname).toBe('/my-tasks')
    expect(within(sidebarNav!).getByRole('link', { name: 'My Tasks' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Nothing assigned to you')).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', async () => {
    renderAt('/does-not-exist')
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})
