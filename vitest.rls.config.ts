import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Row Level Security suite: runs against the *dev* Supabase project over the network, signed in
// as the seeded test users. Kept out of `npm test` because it needs that project to exist.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    // Same project, shared fixture rows: run the files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: loadEnv('development', process.cwd(), 'VITE_'),
  },
})
