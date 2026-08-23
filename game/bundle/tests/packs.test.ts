import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bundle, comparePacks, stableJson, type AssetPackRef } from '../src/index.ts'

const SEALED = JSON.parse(readFileSync(new URL('./fixtures/sealed-bundle.json', import.meta.url), 'utf8')) as unknown
const AS_SHARED: AssetPackRef = { pack: 'kenney-city', version: '1.0.0' }

async function openWith(have: readonly AssetPackRef[]) {
  const opened = await Bundle.open(structuredClone(SEALED), have)
  if (!opened.ok) throw new Error(`the sealed city no longer opens: ${JSON.stringify(opened.error).slice(0, 300)}`)
  return opened.value
}

describe('a city opened against the art the reader actually has', () => {
  /**
   * The whole point of naming art in the file. A reader whose catalogue moved
   * on used to get a quietly re-skinned city with a matching hash. Now the
   * city is the one that was shared, and the disagreement is a line the caller
   * can put in front of the player.
   */
  it('opens a city whose catalogue has moved on, and says so instead of quietly re-skinning it', async () => {
    const asShared = await openWith([AS_SHARED])
    const later = await openWith([{ pack: 'kenney-city', version: '1.3.0' }])

    expect(stableJson(later.world.toJSON())).toBe(stableJson(asShared.world.toJSON()))
    expect(later.contentHash).toBe(asShared.contentHash)
    expect(later.quests.map((quest) => quest.id)).toEqual(asShared.quests.map((quest) => quest.id))

    expect(later.packs.verdicts).toEqual([{ pack: 'kenney-city', wanted: '1.0.0', found: '1.3.0', state: 'newer' }])
    expect(later.packs.asBuilt).toBe(false)
    expect(asShared.packs.asBuilt).toBe(true)
  })

  it('promises nothing about a city that names no art at all', async () => {
    const opened = await openWith([AS_SHARED])
    const nameless = await Bundle.pack(opened.world, opened.quests)

    const reopened = await Bundle.open(nameless, [AS_SHARED])
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.value.packs.verdicts).toEqual([])
    expect(reopened.value.packs.asBuilt).toBe(false)
  })
})

describe('comparePacks', () => {
  const wanted: AssetPackRef = { pack: 'gb-buildings', version: '1.2.0', sha256: 'a'.repeat(64) }

  it('names every way the reader can be out of step, and only calls it the same when it is', () => {
    const states = (have: readonly AssetPackRef[]) => comparePacks([wanted], have).verdicts.map((one) => one.state)

    expect(states([wanted])).toEqual(['same'])
    expect(states([{ pack: 'gb-buildings', version: '1.2.0' }])).toEqual(['same'])
    expect(states([{ ...wanted, version: '1.10.0' }])).toEqual(['newer'])
    expect(states([{ ...wanted, version: '1.1.0' }])).toEqual(['older'])
    expect(states([{ ...wanted, sha256: 'b'.repeat(64) }])).toEqual(['altered'])
    expect(states([])).toEqual(['missing'])
    expect(states([{ pack: 'something-else', version: '1.2.0' }])).toEqual(['missing'])
  })

  it('holds asBuilt to every pack the file names, not just the first', () => {
    const also: AssetPackRef = { pack: 'gb-anims', version: '2.0.0' }
    expect(comparePacks([wanted, also], [wanted, also]).asBuilt).toBe(true)
    expect(comparePacks([wanted, also], [wanted]).asBuilt).toBe(false)
  })
})
