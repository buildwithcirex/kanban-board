import { describe, expect, it } from 'vitest'
import { isThemePreference, resolveTheme, setThemePreference } from './theme'

describe('resolveTheme', () => {
  it('follows the OS for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('uses explicit preferences regardless of the OS', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('isThemePreference', () => {
  it('rejects unknown stored values', () => {
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('blue')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })
})

describe('setThemePreference', () => {
  it('persists the choice and applies it to <html>', () => {
    setThemePreference('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('kb-theme')).toBe('dark')
    setThemePreference('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
