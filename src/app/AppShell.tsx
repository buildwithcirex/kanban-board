import { useEffect } from 'react'
import { NavLink, Outlet, useMatches } from 'react-router'
import { Moon, Sun, TriangleAlert } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'
import { resolveTheme, setThemePreference, useThemePreference } from '@/lib/theme'
import { isRouteHandle, primaryNav } from './nav'

const APP_NAME = 'Kanban'

function usePageTitle(): string {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle
    if (isRouteHandle(handle)) return handle.title
  }
  return APP_NAME
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

export function AppShell() {
  const title = usePageTitle()

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
        <section aria-labelledby="teams-heading" className="mt-6 px-2">
          <h2
            id="teams-heading"
            className="px-3 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase"
          >
            Teams
          </h2>
          <p className="px-3 py-1 text-sm text-fg-muted">No teams yet</p>
        </section>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="md:hidden">
              <Logo />
            </span>
            <h1 className="truncate text-base font-semibold max-md:sr-only">{title}</h1>
          </div>
          <ThemeToggle />
        </header>

        <ConfigBanner />

        <main id="main" tabIndex={-1} className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                  isActive ? 'text-accent' : 'text-fg-muted',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
