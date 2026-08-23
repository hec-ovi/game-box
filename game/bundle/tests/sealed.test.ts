import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bundle } from '../src/index.ts'

/**
 * A city sealed by this packer and checked in as it was shared. It is never
 * regenerated: it is the proof that a file somebody already has still opens,
 * every quest in it is still playable, and resealing it lands on the same
 * hash. Its last quest stashes an item on a real anchor, so opening it asks
 * the world all five questions the quest layer can ask, `hasAnchor` included.
 */
const SEALED = JSON.parse(readFileSync(new URL('./fixtures/sealed-bundle.json', import.meta.url), 'utf8')) as {
  contentHash: string
  quests: { id: string }[]
}
const SEAL = '34102454679cc53b26ef00db15a6558e02c7a7c4c639047b3487a5986f5426d6'

describe('a city sealed before this box changed', () => {
  it('still opens, still plays, and reseals to the hash it was shared with', async () => {
    const opened = await Bundle.open(structuredClone(SEALED))
    expect(opened.ok, `the sealed city no longer opens: ${JSON.stringify('error' in opened ? opened.error : '')}`).toBe(true)
    if (!opened.ok) return

    expect(opened.value.contentHash).toBe(SEAL)
    expect(opened.value.quests.map((quest) => quest.id)).toEqual(SEALED.quests.map((quest) => quest.id))

    const resealed = await Bundle.pack(opened.value.world, opened.value.quests, { requires: opened.value.requires })
    expect(resealed.contentHash).toBe(SEAL)
  })
})
