import { defineConfig } from 'vitest/config'

/** So `pnpm --filter @gb/world test` runs this box on its own, not the whole repo. */
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
