import { Forge, OfflineNarrator } from '@gb/forge'
import { World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Bundle, Pack, stableJson, type OpenedBundle, type PackDoc } from '../src/index.ts'

const ART = [{ pack: 'kenney-city', version: '1.0.0' }]

/** A loosely built town, so `extend` has ground to build on and opens a few of what it builds. */
async function build(seed: string) {
  const forge = new Forge(new OfflineNarrator(seed))
  const built = await forge.build({ theme: 'harbour town', seed, blocksX: 3, blocksY: 3, blockCells: 14, density: 0.5 })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 300))
  const opened = await Bundle.open(await Bundle.pack(built.value.world, built.value.quests, { requires: ART }), ART)
  if (!opened.ok) throw new Error(JSON.stringify(opened.error).slice(0, 300))
  return { forge, built: built.value, base: opened.value }
}

/**
 * The base city, and the same city grown by `Forge.extend` with one more quest
 * written for it. The quest is a base quest under the next id, so it names the
 * base's people and places, which is what a pack's quests are allowed to do.
 */
async function grown() {
  const { forge, built, base } = await build('pack-test')
  const extension = await forge.extend(built.world, 30)
  if (!extension.ok) throw new Error(JSON.stringify(extension.error).slice(0, 300))
  const quest = { ...structuredClone(built.quests[0]!), id: `quest_${String(built.quests.length + 1).padStart(4, '0')}`, title: 'The same errand, asked again' }
  const extended = { world: built.world, quests: [...built.quests, quest] }
  return { base, extended, added: extension.value, quest }
}

async function cut(base: OpenedBundle, extended: { world: World; quests: OpenedBundle['quests'] }): Promise<PackDoc> {
  const pack = await Pack.cut(base, extended)
  if (!pack.ok) throw new Error(JSON.stringify(pack.error).slice(0, 300))
  return pack.value
}

describe('Pack', () => {
  it('holds only what the extension added, and applies back to the extended city byte for byte, twice', async () => {
    const { base, extended, added, quest } = await grown()
    const baseDoc = JSON.stringify(base.world.toJSON())
    const pack = await cut(base, extended)
    const extendedDoc = extended.world.toJSON()

    expect(pack.base).toEqual({ worldId: base.world.id, contentHash: base.contentHash })
    expect(pack.world.plots.map((plot) => plot.id)).toEqual(added)
    expect(pack.world.interiors.length).toBe(extendedDoc.interiors.length - base.world.toJSON().interiors.length)
    expect(pack.world.interiors.length, 'the extension opened nothing, so the pack proves less than it should').toBeGreaterThan(0)
    expect(pack.world.npcs.length).toBeGreaterThan(0)
    expect(pack.world.items.length).toBeGreaterThan(0)
    expect(pack.world.cells.every((cell) => cell.kind === 'building')).toBe(true)
    expect(pack.world.idCounters).toEqual(extendedDoc.idCounters)
    expect(pack.world.idCounters.plot).toBeGreaterThan(base.world.toJSON().idCounters.plot!)
    expect(pack.quests.map((one) => one.id)).toEqual([quest.id])

    const applied = await Pack.apply(base, JSON.parse(JSON.stringify(pack)), ART)
    expect(applied.ok, JSON.stringify('error' in applied ? applied.error : '').slice(0, 300)).toBe(true)
    if (!applied.ok) return
    expect(JSON.stringify(applied.value.world.toJSON())).toBe(JSON.stringify(extendedDoc))
    expect(applied.value.quests.map((one) => one.id)).toEqual(extended.quests.map((one) => one.id))
    expect(applied.value.requires).toEqual(ART)
    expect(applied.value.contentHash).not.toBe(base.contentHash)

    expect(JSON.stringify(base.world.toJSON()), 'applying wrote into the base').toBe(baseDoc)
    const before = base.world.toJSON()
    const after = applied.value.world.toJSON()
    for (const key of ['plots', 'interiors', 'npcs', 'items', 'placements'] as const) {
      before[key].forEach((entry, index) => expect(stableJson(after[key][index]), `${key}.${index}`).toBe(stableJson(entry)))
    }
    for (const charter of before.charters ?? []) expect(after.charters?.find((one) => one.word === charter.word)).toEqual(charter)

    const again = await Pack.apply(base, JSON.parse(JSON.stringify(pack)), ART)
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(stableJson(again.value.world.toJSON())).toBe(stableJson(applied.value.world.toJSON()))
    expect(again.value.contentHash).toBe(applied.value.contentHash)
  })

  it('refuses a pack cut from another city, one edited after it was sealed, and one that is not a pack', async () => {
    const { base, extended } = await grown()
    const pack = await cut(base, extended)
    const other = (await build('another-town')).base

    const elsewhere = await Pack.apply(other, pack)
    expect(elsewhere.ok).toBe(false)
    if (!elsewhere.ok) expect(elsewhere.error.code).toBe('pack-mismatch')

    const tampered = structuredClone(pack)
    tampered.world.plots[0]!.name = 'Somewhere Else'
    const edited = await Pack.apply(base, tampered)
    expect(edited.ok).toBe(false)
    if (!edited.ok) expect(edited.error.code).toBe('content-changed')

    const junk = await Pack.apply(base, { format: 'game-box.bundle' })
    expect(junk.ok).toBe(false)
    if (!junk.ok) expect(junk.error.code).toBe('invalid-pack')
  })

  it('refuses to cut a pack from a city that changed or dropped what the base had, naming each', async () => {
    const { base, extended } = await grown()
    const doc = extended.world.toJSON()
    const renamed = World.load({ ...doc, plots: doc.plots.map((plot, index) => (index === 0 ? { ...plot, name: 'Renamed' } : plot)) })
    if (!renamed.ok) throw new Error('the renamed town did not load')

    const pack = await Pack.cut(base, { world: renamed.value, quests: extended.quests.slice(1) })
    expect(pack.ok).toBe(false)
    if (pack.ok) return
    expect(pack.error.code).toBe('not-an-extension')
    if (pack.error.code !== 'not-an-extension') return
    const everyQuest = base.quests.map((_, index) => `quests.${index}`)
    expect(pack.error.problems.map((problem) => problem.path)).toEqual(['plots.0', ...everyQuest])
  })
})
