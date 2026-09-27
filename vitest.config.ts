import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // Vite loads `.env` for this mode too, which would give component tests a *real* Supabase
      // client: they would open websockets and make network calls against the dev project.
      // Blanking these makes `lib/supabase` null, so anything that slips past a mock fails
      // loudly and offline instead of quietly talking to the database.
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_DEV_USER_PASSWORD: '' },
    },
  }),
)
