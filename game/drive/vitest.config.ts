import { defineConfig } from 'vitest/config'

/** Lets `pnpm --filter @gb/drive test` run this box on its own. */
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
