/// <reference types="vite/client" />

// Merges with vite/client's ImportMetaEnv (BASE_URL, MODE, DEV, PROD, SSR).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Development only; see src/lib/env.ts. */
  readonly VITE_DEV_USER_PASSWORD?: string
}
