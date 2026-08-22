/**
 * The published schemas are what callers build against, so they have to be the
 * same objects the code validates with.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileFor, published, serialise } from '../tools/emit-schema.ts'

describe('schema/', () => {
  it('holds exactly what the contracts publish', () => {
    for (const [layer, contracts] of Object.entries(published)) {
      for (const entry of contracts) {
        const path = fileFor(layer, entry.name)
        assert.equal(
          readFileSync(path, 'utf8'),
          serialise(entry),
          `${path} is stale: run npm run generate`,
        )
      }
    }
  })
})
