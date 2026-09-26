import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/renderApp'

describe('AppShell', () => {
  it('renders the boards page by default and sets the document title', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Boards' })).toBeInTheDocument()
    expect(document.title).toBe('Boards · Kanban')
  })

  it('navigates between sections and marks the active link', async () => {
    const router = renderApp('/')
    const [sidebarNav] = screen.getAllByRole('navigation', { name: 'Main' })
    await userEvent.click(within(sidebarNav!).getByRole('link', { name: 'My Tasks' }))
    expect(router.state.location.pathname).toBe('/my-tasks')
    expect(within(sidebarNav!).getByRole('link', { name: 'My Tasks' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Nothing assigned to you')).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes, signed in or not', async () => {
    renderApp('/does-not-exist', { status: 'signed-out' })
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})

describe('AuthGate', () => {
  it('hides private pages until there is a session', async () => {
    renderApp('/my-tasks', { status: 'signed-out' })
    expect(await screen.findByText('Sign in to continue')).toBeInTheDocument()
    expect(screen.queryByText('Nothing assigned to you')).not.toBeInTheDocument()
  })

  it('waits instead of flashing the sign-in prompt while the session is restored', () => {
    renderApp('/', { status: 'loading' })
    expect(screen.getByRole('status', { name: 'Restoring your session' })).toBeInTheDocument()
    expect(screen.queryByText('Sign in to continue')).not.toBeInTheDocument()
  })
})
