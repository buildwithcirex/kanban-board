import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useMatches } from 'react-router'
import { LogIn, Moon, Sun, TriangleAlert } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/useAuth'
import { TeamNav } from '@/features/teams/TeamNav'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'
import { resolveTheme, setThemePreference, useThemePreference } from '@/lib/theme'
import { isRouteHandle, primaryNav, type RouteHandle } from './nav'
import { PageTitleContext } from './pageTitle'

const APP_NAME = 'Kanban'

// Vite replaces import.meta.env.DEV with `false` for production builds, so the switcher and the
// seeded test accounts are tree-shaken out of the shipped bundle entirely.
const DevUserSwitcher = import.meta.env.DEV
  ? lazy(() => import('@/features/dev-user-switcher/DevUserSwitcher'))
  : null

function useRouteHandle(): RouteHandle | null {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle
    if (isRouteHandle(handle)) return handle
  }
  return null
}

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-fg">
      <img src="/favicon.svg" alt="" className="size-6" />
      {APP_NAME}
    </span>
  )
}

function ThemeToggle() {
  const preference = useThemePreference()
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = resolveTheme(preference, prefersDark) === 'dark'
  return (
    <IconButton
      label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      icon={isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      onClick={() => setThemePreference(isDark ? 'light' : 'dark')}
    />
  )
}

function ConfigBanner() {
  if (env.ok) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-fg"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        Supabase isn&apos;t configured. Copy <code>.env.example</code> to <code>.env.local</code>,
        add your project URL and anon key, then restart the dev server.
      </p>
    </div>
  )
}

/**
 * Nothing behind the shell renders until there is a session, so no feature has to cope with a
 * missing user. Until Phase 11 ships the login screens, signing in is the dev switcher's job.
 */
function AuthGate({ isPublic, children }: { isPublic: boolean; children: ReactNode }) {
  const { status } = useAuth()

  if (isPublic) return children

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner label="Restoring your session" className="size-6 text-fg-muted" />
      </div>
    )
  }

  if (status === 'unconfigured') {
    return (
      <EmptyState
        icon={<TriangleAlert />}
        title="Backend not configured"
        description="Add your Supabase URL and anon key to .env.local, then restart the dev server."
      />
    )
  }

  if (status === 'signed-out') {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-12">
        <EmptyState
          icon={<LogIn />}
          title="Sign in to continue"
          description="Boards, cards and notifications are private to your team."
        />
        {DevUserSwitcher && (
          <Suspense fallback={<Spinner label="Loading test users" />}>
            <DevUserSwitcher variant="panel" />
          </Suspense>
        )}
      </div>
    )
  }

  return children
}

export function AppShell() {
  const handle = useRouteHandle()
  const { pathname } = useLocation()
  const [override, setOverride] = useState<{ path: string; title: string } | null>(null)

  // Tying the override to the path it came from means a navigation drops it without an extra
  // effect — the stale title simply stops matching.
  const title = (override?.path === pathname ? override.title : null) ?? handle?.title ?? APP_NAME

  const setPageTitle = useCallback(
    (next: string | null) => setOverride(next ? { path: pathname, title: next } : null),
    [pathname],
  )

  useEffect(() => {
    document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`
  }, [title])

  return (
    <div className="flex h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center px-4">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 px-2">
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <TeamNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="md:hidden">
              <Logo />
            </span>
            <h1 className="truncate text-base font-semibold max-md:sr-only">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {DevUserSwitcher && (
              <Suspense fallback={null}>
                <DevUserSwitcher />
              </Suspense>
            )}
            <ThemeToggle />
          </div>
        </header>

        <ConfigBanner />

        <main id="main" tabIndex={-1} className="flex flex-1 flex-col overflow-auto pb-16 md:pb-0">
          <AuthGate isPublic={handle?.public === true}>
            <PageTitleContext.Provider value={setPageTitle}>
              <Outlet />
            </PageTitleContext.Provider>
          </AuthGate>
        </main>

        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {primaryNav.map(({ to, label, shortLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-medium',
                  isActive ? 'text-accent' : 'text-fg-muted',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              <span className="truncate">{shortLabel ?? label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
