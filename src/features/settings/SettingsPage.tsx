import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, Monitor, Moon, RefreshCw, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Page } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'
import { checkSupabaseHealth } from '@/lib/supabase'
import { setThemePreference, useThemePreference, type ThemePreference } from '@/lib/theme'

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function AppearanceSettings() {
  const preference = useThemePreference()
  return (
    <Section title="Appearance">
      <fieldset>
        <legend className="mb-2 text-sm text-fg-muted">Theme</legend>
        <div className="flex flex-wrap gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                'flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                preference === value
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border-strong text-fg hover:bg-surface-sunken',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={preference === value}
                onChange={() => setThemePreference(value)}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </Section>
  )
}

function ConnectionSettings() {
  const health = useQuery({
    queryKey: ['supabase-health'],
    queryFn: ({ signal }) => checkSupabaseHealth(signal),
    enabled: env.ok,
    retry: false,
  })

  let status: ReactNode
  if (!env.ok) {
    status = (
      <StatusLine tone="error" text="Not configured">
        <ul className="mt-1 list-disc pl-5 text-xs text-fg-muted">
          {env.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </StatusLine>
    )
  } else if (health.isPending) {
    status = (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Checking connection…
      </p>
    )
  } else if (health.data?.reachable) {
    status = <StatusLine tone="ok" text="Connected" />
  } else {
    status = <StatusLine tone="error" text={health.data?.reason ?? 'Connection check failed'} />
  }

  return (
    <Section title="Backend">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite">{status}</div>
        {env.ok && (
          <Button
            size="sm"
            icon={<RefreshCw className="size-4" />}
            loading={health.isFetching}
            onClick={() => void health.refetch()}
          >
            Check again
          </Button>
        )}
      </div>
      {env.ok && <p className="text-xs break-all text-fg-muted">{env.value.supabaseUrl}</p>}
    </Section>
  )
}

function StatusLine({
  tone,
  text,
  children,
}: {
  tone: 'ok' | 'error'
  text: string
  children?: ReactNode
}) {
  const Icon = tone === 'ok' ? CircleCheck : CircleX
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon
          className={cn('size-4', tone === 'ok' ? 'text-success' : 'text-danger')}
          aria-hidden
        />
        {text}
      </p>
      {children}
    </div>
  )
}

export function SettingsPage() {
  return (
    <Page title="Settings">
      <div className="flex max-w-2xl flex-col gap-4">
        <AppearanceSettings />
        <ConnectionSettings />
      </div>
    </Page>
  )
}
