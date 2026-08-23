import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PUBLISHED, schemaText } from '../src/index.ts'

/**
 * The published schemas are mostly not this box's own shapes: they embed
 * `@gb/world`, `@gb/quest` and `@gb/play`'s schemas whole. So they go stale
 * when one of those boxes adds a field and nothing here changes, and nobody
 * editing those boxes has a reason to look in this folder. This is the only
 * thing that notices, and it costs a file read and a stringify.
 */
describe('the published schemas', () => {
  for (const published of PUBLISHED) {
    it(`schema/${published.name}.json is what this box generates today`, () => {
      const committed = readFileSync(new URL(`../schema/${published.name}.json`, import.meta.url), 'utf8')
      expect(committed, 'stale: run pnpm --filter @gb/bundle run generate').toBe(schemaText(published))
    })
  }
})
