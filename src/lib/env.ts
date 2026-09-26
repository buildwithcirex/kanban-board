import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({
    error: (issue) => (issue.input === undefined ? 'is missing' : 'must be a valid URL'),
  }),
  VITE_SUPABASE_ANON_KEY: z
    .string({ error: 'is missing' })
    .min(20, { error: 'looks too short to be an anon key' }),
})

export type AppEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

export type EnvResult = { ok: true; value: AppEnv } | { ok: false; issues: string[] }

export function parseEnv(raw: Record<string, unknown>): EnvResult {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`),
    }
  }
  return {
    ok: true,
    value: {
      supabaseUrl: result.data.VITE_SUPABASE_URL.replace(/\/+$/, ''),
      supabaseAnonKey: result.data.VITE_SUPABASE_ANON_KEY,
    },
  }
}

// Variables are read one by one on purpose. Vite inlines a whole `import.meta.env` object when it
// is referenced as a value, which would bake every VITE_* variable — including development-only
// ones — into the production bundle.
export const env = parseEnv({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
})

/**
 * Development-only configuration, read by the dev user switcher (plan §1.3) so it can sign in as
 * a seeded test user. `import.meta.env.DEV` is replaced with `false` when building for
 * production, so this branch — and the password literal inside it — is dropped by the bundler.
 */
export function parseDevEnv(raw: Record<string, unknown>): { userPassword: string | null } {
  const value = raw['VITE_DEV_USER_PASSWORD']
  return { userPassword: typeof value === 'string' && value.length > 0 ? value : null }
}

export const devEnv: { userPassword: string | null } = import.meta.env.DEV
  ? parseDevEnv({ VITE_DEV_USER_PASSWORD: import.meta.env.VITE_DEV_USER_PASSWORD })
  : { userPassword: null }
