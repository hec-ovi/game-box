import { defineConfig } from 'vitest/config'

/** Lets `pnpm --filter @gb/traffic test` run this box on its own. */
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
