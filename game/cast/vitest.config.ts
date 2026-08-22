import { defineConfig } from 'vitest/config'

/** So `pnpm --filter @gb/cast test` runs this box on its own, not the whole repo. */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
