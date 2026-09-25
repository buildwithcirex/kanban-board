import { useContext } from 'react'
import { AuthContext, type AuthState } from './AuthContext'

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

/** The signed-in user's id, or null. Handy for "is this mine?" checks. */
export function useUserId(): string | null {
  return useAuth().user?.id ?? null
}
