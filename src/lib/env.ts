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

export const env = parseEnv(import.meta.env)
