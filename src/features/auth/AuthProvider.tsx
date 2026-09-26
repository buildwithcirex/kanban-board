import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthState, type AuthStatus } from './AuthContext'

/**
 * Owns the Supabase session. Until Phase 11 there are no login screens: in development the user
 * switcher signs in as a seeded test user, which means Row Level Security is exercised for real
 * from the first feature onwards.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured')

  useEffect(() => {
    if (!supabase) return
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signed-in' : 'signed-out')
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setStatus(next ? 'signed-in' : 'signed-out')
      // Cached rows belong to the previous user; never let them leak across a switch.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') queryClient.clear()
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [queryClient])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({ status, session, user: session?.user ?? null, signOut }),
    [status, session, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
