import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

// Keep the key and resolution logic in sync with the inline script in index.html.
const STORAGE_KEY = 'kb-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

let preference: ThemePreference = readPreference()
const listeners = new Set<() => void>()

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

function apply(): void {
  document.documentElement.dataset.theme = resolveTheme(preference, prefersDark())
}

export function setThemePreference(next: ThemePreference): void {
  preference = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage unavailable (private mode); the choice still applies for this session.
  }
  apply()
  listeners.forEach((listener) => listener())
}

/** Applies the theme and follows OS changes while the preference is "system". */
export function initTheme(): void {
  apply()
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (preference === 'system') apply()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference)
}
