import { describe, expect, it } from 'vitest'
import { parseDevEnv, parseEnv } from './env'

describe('parseEnv', () => {
  it('accepts a valid config and strips trailing slashes from the URL', () => {
    const result = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co/',
      VITE_SUPABASE_ANON_KEY: 'x'.repeat(40),
    })
    expect(result).toEqual({
      ok: true,
      value: { supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'x'.repeat(40) },
    })
  })

  it('reports every missing variable', () => {
    const result = parseEnv({})
    expect(result.ok).toBe(false)
    const issues = result.ok ? [] : result.issues
    expect(issues).toHaveLength(2)
    expect(issues.join(' ')).toContain('VITE_SUPABASE_URL')
    expect(issues.join(' ')).toContain('VITE_SUPABASE_ANON_KEY')
  })

  it('rejects an invalid URL', () => {
    const result = parseEnv({
      VITE_SUPABASE_URL: 'not a url',
      VITE_SUPABASE_ANON_KEY: 'x'.repeat(40),
    })
    expect(result.ok).toBe(false)
  })
})

describe('parseDevEnv', () => {
  it('reads the dev password when present', () => {
    expect(parseDevEnv({ VITE_DEV_USER_PASSWORD: 'secret' })).toEqual({ userPassword: 'secret' })
  })

  it('is null when unset or empty, so the switcher can explain why', () => {
    expect(parseDevEnv({})).toEqual({ userPassword: null })
    expect(parseDevEnv({ VITE_DEV_USER_PASSWORD: '' })).toEqual({ userPassword: null })
  })
})
