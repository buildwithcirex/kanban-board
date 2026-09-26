import { useState } from 'react'
import { Check, TriangleAlert, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/useAuth'
import { cn } from '@/lib/cn'
import { devEnv } from '@/lib/env'
import { requireSupabase } from '@/lib/supabase'
import { devUsers, initials, type DevUser } from './devUsers'

/**
 * Development-only sign-in (plan §1.3, option A).
 *
 * It uses the real Supabase password sign-in for seeded test users, so every request the app
 * makes carries a genuine JWT and RLS behaves exactly as it will in production. Phase 11 replaces
 * this with the actual login screens and deletes this folder.
 *
 * The whole module sits behind `import.meta.env.DEV`, which Vite folds to `false` when building
 * for production — nothing here, including the test emails, reaches the shipped bundle.
 */

type Variant = 'header' | 'panel'

function useSignIn() {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function signIn(user: DevUser) {
    const password = devEnv.userPassword
    if (!password) {
      setError('Set VITE_DEV_USER_PASSWORD in .env.local to use the switcher.')
      return
    }
    setPendingEmail(user.email)
    setError(null)
    const { error: signInError } = await requireSupabase().auth.signInWithPassword({
      email: user.email,
      password,
    })
    setPendingEmail(null)
    if (signInError) {
      setError(`Could not sign in as ${user.name}. Has supabase/seed.sql been run?`)
    }
  }

  return { signIn, pendingEmail, error }
}

function UserList({ onPicked }: { onPicked?: () => void }) {
  const { user } = useAuth()
  const { signIn, pendingEmail, error } = useSignIn()

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {devUsers.map((devUser) => {
          const isCurrent = user?.email === devUser.email
          const isPending = pendingEmail === devUser.email
          return (
            <li key={devUser.email}>
              <button
                type="button"
                disabled={isPending || isCurrent}
                aria-current={isCurrent || undefined}
                onClick={() => {
                  void signIn(devUser).then(onPicked)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                  isCurrent ? 'bg-accent-soft' : 'hover:bg-surface-sunken disabled:opacity-60',
                )}
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-fg"
                >
                  {initials(devUser.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{devUser.name}</span>
                  <span className="block truncate text-xs text-fg-muted">{devUser.hint}</span>
                </span>
                {isPending && <Spinner label={`Signing in as ${devUser.name}`} />}
                {isCurrent && <Check className="size-4 text-accent" aria-hidden />}
              </button>
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-xs text-danger">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

export default function DevUserSwitcher({ variant = 'header' }: { variant?: Variant }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (variant === 'panel') {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-lg border border-dashed border-border-strong bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-fg">Sign in as a test user</h2>
          <p className="text-xs text-fg-muted">
            Development only. Real login screens arrive in Phase 11.
          </p>
        </div>
        <UserList />
      </div>
    )
  }

  const label = user?.email ?? 'Signed out'

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={<UserRound className="size-4" />}
        onClick={() => setOpen(true)}
        title="Development user switcher"
      >
        <span className="max-w-32 truncate">{label}</span>
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Switch test user"
        description="Development only — signs in with Supabase Auth so RLS applies for real."
        footer={
          user ? (
            <Button
              size="sm"
              onClick={() => {
                void signOut()
                setOpen(false)
              }}
            >
              Sign out
            </Button>
          ) : null
        }
      >
        <UserList onPicked={() => setOpen(false)} />
      </Dialog>
    </>
  )
}
