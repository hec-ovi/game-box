import { readFileSync } from 'node:fs'
import { SHIPPED_CHARTERS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Bundle, stableJson, type OpenedBundle } from '../src/index.ts'

/**
 * A city sealed by this packer before charters and checked in as it was
 * shared. It is never regenerated: it is the proof that a file somebody
 * already has still opens, every quest in it is still playable, and its
 * identity is still the hash it was shared with. Its last quest stashes an
 * item on a real anchor, so opening it asks the world all five questions the
 * quest layer can ask, `hasAnchor` included.
 */
const SEALED = JSON.parse(readFileSync(new URL('./fixtures/sealed-bundle.json', import.meta.url), 'utf8')) as {
  schemaVersion: number
  world: { plots: { kind: string }[] }
  contentHash: string
  quests: { id: string }[]
}
const SEAL = '34102454679cc53b26ef00db15a6558e02c7a7c4c639047b3487a5986f5426d6'

/** The document with what the upgrade wrote taken back out, to show it wrote nothing else. */
function asWritten(doc: ReturnType<OpenedBundle['world']['toJSON']>): unknown {
  const { charters: _charters, ...rest } = doc
  return { ...rest, interiors: doc.interiors.map((interior) => ({ ...interior, rooms: interior.rooms.map(({ use: _use, ...room }) => room) })) }
}

describe('a city sealed before charters', () => {
  it('still opens under the hash it was shared with, and comes out carrying the presets it was drawn with', async () => {
    expect(SEALED.schemaVersion).toBe(1)
    const opened = await Bundle.open(structuredClone(SEALED))
    expect(opened.ok, `the sealed city no longer opens: ${JSON.stringify('error' in opened ? opened.error : '')}`).toBe(true)
    if (!opened.ok) return

    expect(opened.value.contentHash).toBe(SEAL)
    expect(opened.value.quests.map((quest) => quest.id)).toEqual(SEALED.quests.map((quest) => quest.id))
    expect(opened.value.upgraded).toBe(true)

    const doc = opened.value.world.toJSON()
    expect(doc.charters?.map((charter) => charter.word).sort()).toEqual(SHIPPED_CHARTERS.map((charter) => charter.word).sort())
    expect(doc.interiors.flatMap((interior) => interior.rooms).every((room) => room.use !== undefined)).toBe(true)
    expect(doc.plots.map((plot) => plot.kind)).toEqual(SEALED.world.plots.map((plot) => plot.kind))
    expect(stableJson(asWritten(doc))).toBe(stableJson(SEALED.world))
  })

  it('resealed, it is a self-describing file that reopens with nothing left to upgrade', async () => {
    const opened = await Bundle.open(structuredClone(SEALED))
    if (!opened.ok) throw new Error('the sealed city did not open')

    const resealed = await Bundle.pack(opened.value.world, opened.value.quests, { requires: opened.value.requires })
    expect(resealed.schemaVersion).toBe(2)
    expect(resealed.contentHash).not.toBe(SEAL)

    const reopened = await Bundle.open(JSON.parse(JSON.stringify(resealed)))
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.value.upgraded).toBe(false)
    const again = await Bundle.pack(reopened.value.world, reopened.value.quests, { requires: reopened.value.requires })
    expect(again.contentHash).toBe(resealed.contentHash)
  })
})
