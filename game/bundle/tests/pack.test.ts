import { cellRows, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Bundle, Pack, stableJson, type OpenedBundle, type PackDoc } from '../src/index.ts'
import { errand, grow, laidOut, type Raised } from './town.ts'

const ART = [{ pack: 'kenney-city', version: '1.0.0' }]

/** A town with one place open in it and a job to do there, sealed and opened as the file anybody would hold. */
async function based(seed: string, world = laidOut(seed)) {
  const [place] = grow(world, 1, { anchors: 2, people: 1, things: 2 })
  const quests = [errand('quest_0001', 'The thing on the shelf', place!)]
  const opened = await Bundle.open(await Bundle.pack(world, quests, { requires: ART }), ART)
  if (!opened.ok) throw new Error(JSON.stringify(opened.error).slice(0, 300))
  return { base: opened.value, place: place! }
}

/**
 * The base city, and the same city with one more building on it and one more
 * quest over it. The growth is written onto a world loaded from the base's own
 * document, so the base opened on its own is never the object that was grown,
 * which is the shape a caller who grew a city is left in.
 *
 * The new quest sends the player to the base's own place with what the growth
 * put up, because a pack's quests are validated against the whole city and may
 * name what the base already had.
 */
async function grown(base: OpenedBundle, at: Raised) {
  const loaded = World.load(base.world.toJSON())
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error).slice(0, 300))
  const [added] = grow(loaded.value, 1, { anchors: 3, people: 2, things: 3 })
  const quest = errand('quest_0002', 'The new thing, stowed in the old place', at, added!.itemIds[0]!)
  return { extended: { world: loaded.value, quests: [...base.quests, quest] }, added: added!, quest }
}

async function cut(base: OpenedBundle, extended: { world: World; quests: OpenedBundle['quests'] }): Promise<PackDoc> {
  const pack = await Pack.cut(base, extended)
  if (!pack.ok) throw new Error(JSON.stringify(pack.error).slice(0, 300))
  return pack.value
}

describe('Pack', () => {
  it('holds only what the extension added, and applies back to the extended city byte for byte, twice', async () => {
    const { base, place } = await based('pack-test')
    const { extended, added, quest } = await grown(base, place)
    const baseDoc = JSON.stringify(base.world.toJSON())
    const pack = await cut(base, extended)
    const extendedDoc = extended.world.toJSON()

    expect(pack.base).toEqual({ worldId: base.world.id, contentHash: base.contentHash })
    expect(pack.world.plots.map((plot) => plot.id)).toEqual([added.plotId])
    expect(pack.world.interiors.map((interior) => interior.id)).toEqual([added.interiorId])
    expect(pack.world.npcs.map((npc) => npc.id)).toEqual(added.npcIds)
    expect(pack.world.items.map((item) => item.id)).toEqual(added.itemIds)
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

  it('leaves a base written one char a cell in the bytes it was sealed with', async () => {
    // a file shared before the grid could be run length encoded carries rows,
    // and applying a pack to it must not rewrite the picture into runs: the
    // hash every other pack names it by is over those bytes
    const doc = laidOut('rows-town').toJSON()
    const rows = World.load({ ...doc, grid: { width: doc.grid.width, height: doc.grid.height, rows: cellRows(doc.grid) } })
    if (!rows.ok) throw new Error(JSON.stringify(rows.error).slice(0, 300))
    const { base, place } = await based('rows-town', rows.value)
    const { extended } = await grown(base, place)

    const applied = await Pack.apply(base, JSON.parse(JSON.stringify(await cut(base, extended))), ART)
    expect(applied.ok, JSON.stringify('error' in applied ? applied.error : '').slice(0, 300)).toBe(true)
    if (!applied.ok) return
    const grid = applied.value.world.toJSON().grid
    expect(grid.rows, 'the pack rewrote the base picture into runs').toBeDefined()
    expect(grid.runs).toBeUndefined()
    expect(stableJson(applied.value.world.toJSON())).toBe(stableJson(extended.world.toJSON()))
  })

  it('refuses a pack cut from another city, one edited after it was sealed, and one that is not a pack', async () => {
    const { base, place } = await based('pack-test')
    const pack = await cut(base, (await grown(base, place)).extended)
    const other = (await based('another-town')).base

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
    const { base, place } = await based('pack-test')
    const { extended } = await grown(base, place)
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
