import { describe, expect, it } from 'vitest'
import { AppError, toAppError, unwrap } from './errors'

describe('toAppError', () => {
  it('maps an RLS denial to "forbidden" without echoing the database message', () => {
    const error = toAppError({
      code: '42501',
      message: 'new row violates row-level security policy for table "cards"',
      details: '',
      hint: '',
      name: 'PostgrestError',
    })
    expect(error.kind).toBe('forbidden')
    expect(error.message).not.toContain('cards')
    expect(error.message).not.toContain('row-level')
  })

  it.each([
    ['PGRST116', 'not-found'],
    ['23505', 'conflict'],
    ['23514', 'invalid'],
    ['08P01', 'unknown'],
  ] as const)('maps %s to %s', (code, kind) => {
    expect(toAppError({ code }).kind).toBe(kind)
  })

  it('passes an AppError through unchanged', () => {
    const original = new AppError('conflict', 'nope')
    expect(toAppError(original)).toBe(original)
  })

  it('keeps the original error as the cause for debugging', () => {
    const raw = { code: '42501' }
    expect(toAppError(raw).cause).toBe(raw)
  })
})

describe('unwrap', () => {
  it('returns data when there is no error', () => {
    expect(unwrap({ data: [1, 2], error: null })).toEqual([1, 2])
  })

  it('treats a null payload as not found', () => {
    expect(() => unwrap({ data: null, error: null })).toThrowError(AppError)
  })
})
