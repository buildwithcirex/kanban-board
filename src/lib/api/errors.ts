import type { PostgrestError } from '@supabase/supabase-js'

export type AppErrorKind =
  'forbidden' | 'not-found' | 'conflict' | 'invalid' | 'offline' | 'unknown'

/**
 * A database error translated for the UI. The original Postgres message is kept off `message`
 * on purpose: those strings can name tables, columns and constraints, which is information the
 * user has no business seeing. The raw error stays on `cause` for the console.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly code: string | undefined

  constructor(kind: AppErrorKind, message: string, code?: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'AppError'
    this.kind = kind
    this.code = code
  }
}

const messages: Record<AppErrorKind, string> = {
  forbidden: "You don't have access to this.",
  'not-found': "That doesn't exist, or you can't see it.",
  conflict: 'Someone changed this first. Refresh and try again.',
  invalid: "That doesn't look right. Check the values and try again.",
  offline: "You're offline. Changes will need a connection.",
  unknown: 'Something went wrong. Please try again.',
}

function kindFor(code: string | undefined): AppErrorKind {
  switch (code) {
    // RLS denial and plain permission errors are the same thing to a user.
    case '42501':
    case 'PGRST301':
      return 'forbidden'
    case 'PGRST116':
      return 'not-found'
    case '23505': // unique_violation
    case '40001': // serialization_failure
      return 'conflict'
    case '23502': // not_null_violation
    case '23503': // foreign_key_violation
    case '23514': // check_violation
    case '22001': // string_data_right_truncation
      return 'invalid'
    default:
      return 'unknown'
  }
}

export function toAppError(error: PostgrestError | Error | null | unknown): AppError {
  if (error instanceof AppError) return error

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new AppError('offline', messages.offline, undefined, error)
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined

  const kind = kindFor(code)
  return new AppError(kind, messages[kind], code, error)
}

/** Unwraps a PostgREST `{ data, error }` result, throwing a UI-safe error. */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw toAppError(result.error)
  if (result.data === null) throw new AppError('not-found', messages['not-found'])
  return result.data
}
