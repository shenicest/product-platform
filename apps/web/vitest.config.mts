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
    // 交互密集的用例（技能墙 20 次点击、完整项目表单）在 CI 的 2 核 runner
    // 上会超过 vitest 默认的 5s。这里统一放宽到 20s；真正挂起的用例仍会失败，
    // 只是不会被机器慢误判成超时。
    testTimeout: 20_000,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
