import type { Session, User } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/routes'
import { AuthContext, type AuthState, type AuthStatus } from '@/features/auth/AuthContext'

/**
 * Renders the real router with a stubbed auth state, so component tests can exercise both the
 * signed-in and signed-out shells without touching the network.
 */

const testUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ada@kanban.test',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00.000Z',
} as unknown as User

function authState(status: AuthStatus): AuthState {
  const user = status === 'signed-in' ? testUser : null
  return {
    status,
    session: user ? ({ user } as unknown as Session) : null,
    user,
    signOut: async () => {},
  }
}

export function renderApp(path: string, { status = 'signed-in' }: { status?: AuthStatus } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authState(status)}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )

  return router
}
