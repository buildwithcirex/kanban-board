import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unconfigured'

export type AuthState = {
  status: AuthStatus
  session: Session | null
  user: User | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
