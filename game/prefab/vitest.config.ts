import { defineConfig } from 'vitest/config'

// The root config globs from the repo root, so a filtered run inside this
// folder finds nothing without a local one.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
