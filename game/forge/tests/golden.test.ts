import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { goldenCases, pin, type GoldenPin } from './golden.ts'

/** The cities pinned by `pnpm run golden`. */
const PINNED = JSON.parse(readFileSync(new URL('./fixtures/golden.json', import.meta.url), 'utf8')) as GoldenPin[]

describe('the golden cities', () => {
  it('builds every pinned seed and history to the same bytes', async () => {
    // same seed and same history, same city: with no model at all the presets
    // build the city they built when the pin was taken, and a history that
    // invents a kind of place builds the same city every time. A preset
    // transcription or a draw order that moves is caught here, never shipped
    const cases = goldenCases()
    expect(PINNED.map(({ seed, history }) => ({ seed, history }))).toEqual(cases)
    const built = await Promise.all(cases.map(pin))
    for (const [at, one] of built.entries()) {
      expect(one, `${one.seed}/${one.history} built a different city`).toEqual(PINNED[at])
    }
  })
})
