import { defineConfig } from 'vitest/config'

// So `pnpm --filter @gb/app test` runs this box on its own. The workspace run
// picks the environment up from the docblock at the top of each test file.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'jsdom' },
})
