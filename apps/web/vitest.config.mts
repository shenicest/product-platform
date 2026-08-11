import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Native tsconfig-paths resolution (replaces vite-tsconfig-paths). Picks up
    // the `@/*` alias defined in apps/web/tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    // Give jsdom a stable base URL so `fetch('/api/...')` resolves to a
    // predictable origin that MSW handlers can match against.
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000/',
      },
    },
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
