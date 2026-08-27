import { cellRows, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, OfflineNarrator, type Growth } from '../src/index.ts'
import { line, playEvery } from './playable.ts'
import { buildTown } from './support.ts'

/**
 * Growing a finished city.
 *
 * A pack opens doors that were painted on, puts new land up at the edge, and
 * writes the work that makes either worth walking into. The city somebody
 * already played is the thing being protected: everything below is measured
 * against the base's own records, before and after.
 */

const SEED = 'growth'

/** A city built and sealed. The document is the file a pack author and a player each hold a copy of. */
async function sealed(seed: string, blocks = 4) {
  const built = await buildTown(seed, { blocksX: blocks, blocksY: blocks })
  return { quests: built.quests, doc: JSON.parse(JSON.stringify(built.world.toJSON())) as ReturnType<World['toJSON']> }
}

/** One copy of that file, opened, with a forge that never saw the city being built. */
function copy(doc: ReturnType<World['toJSON']>): World {
  const loaded = World.load(structuredClone(doc))
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error).slice(0, 400))
  return loaded.value
}

const forge = () => new Forge(new OfflineNarrator(SEED))

/** A copy of the base, grown, with the work the growth wrote. */
async function grow(base: Awaited<ReturnType<typeof sealed>>, growth: number | Growth) {
  const world = copy(base.doc)
  const one = forge()
  const added = await one.extend(world, growth)
  if (!added.ok) throw new Error(JSON.stringify(added.error).slice(0, 400))
  const work = await one.extendQuests(world, base.quests)
  if (!work.ok) throw new Error(JSON.stringify(work.error).slice(0, 400))
  return { world, added: added.value, ...work.value }
}

/** Which plots you can walk into. */
const openPlots = (world: World) => new Set(world.interiors().map((interior) => interior.plotId))

const base = await sealed(SEED)
const openAtFirst = new Set(base.doc.interiors.map((interior) => interior.plotId))
const grown = await grow(base, { blocks: 12, places: 2 })

describe('a growth opens doors that were painted on', () => {
  it('turns the frontage it was asked for into real places, and never one that was open already', async () => {
    const facades = await grow(base, { places: 2 })
    const opened = [...openPlots(facades.world)].filter((plotId) => !openAtFirst.has(plotId))

    expect(facades.added, 'a growth of facades put a building up').toEqual([])
    expect(facades.world.plots().length, 'the matrix changed').toBe(base.doc.plots.length)
    expect(opened.length).toBe(2)
    for (const plotId of opened) {
      const interior = facades.world.interiors().find((one) => one.plotId === plotId)!
      expect(facades.world.npcsIn(plotId).length, `${facades.world.plot(plotId)!.name} opened with nobody in it`).toBeGreaterThan(0)
      expect(facades.world.placements().filter((at) => at.at === 'anchor' && at.interiorId === interior.id).length).toBeGreaterThan(0)
    }
  })

  it('keeps the sign that was over the door', async () => {
    const facades = await grow(base, { places: 2 })
    const named = new Map(base.doc.plots.map((plot) => [plot.id, plot.name]))
    for (const plotId of [...openPlots(facades.world)].filter((one) => !openAtFirst.has(one))) {
      expect(facades.world.plot(plotId)!.name, 'an opened facade was renamed under the player').toBe(named.get(plotId))
    }
  })

  it('puts new land up with its own doors, and asks for both at once', () => {
    const opened = [...openPlots(grown.world)].filter((plotId) => !openAtFirst.has(plotId))
    const standing = new Set(base.doc.plots.map((plot) => plot.id))

    expect(grown.added.length, 'no new land went up').toBeGreaterThan(0)
    expect(opened.filter((plotId) => standing.has(plotId)).length, 'the facades it was asked for did not open').toBe(2)
    expect(opened.filter((plotId) => !standing.has(plotId)).length, 'new land opened no door of its own').toBeGreaterThan(0)
    expect(grown.world.check()).toEqual([])
  })
})

describe('a growth leaves the city somebody already played alone', () => {
  it('changes no base record but the door pointer of a facade it opened', () => {
    const after = grown.world.toJSON()
    const opened = new Set([...openPlots(grown.world)].filter((plotId) => !openAtFirst.has(plotId)))

    for (const [at, plot] of base.doc.plots.entries()) {
      const now = after.plots[at]!
      const expected = opened.has(plot.id) ? { ...plot, interiorId: now.interiorId } : plot
      expect(now, `plot ${plot.id} was rewritten`).toEqual(expected)
      if (opened.has(plot.id)) expect(now.interiorId, `${plot.id} opened onto nothing`).toBeTruthy()
    }
    for (const list of ['interiors', 'npcs', 'items', 'placements'] as const) {
      for (const [at, record] of base.doc[list].entries()) {
        expect(JSON.stringify(after[list][at]), `${list}.${at} was rewritten`).toBe(JSON.stringify(record))
      }
    }
    for (const field of ['id', 'name', 'theme', 'seed', 'premise', 'charters', 'roads', 'cellSize'] as const) {
      expect(JSON.stringify(after[field]), `the city's ${field} was rewritten`).toBe(JSON.stringify(base.doc[field]))
    }
  })

  it('builds only on ground that was empty', () => {
    const after = grown.world.toJSON()
    expect(after.grid.width).toBe(base.doc.grid.width)
    const rows = cellRows(after.grid)
    for (const [y, row] of cellRows(base.doc.grid).entries()) {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.') continue
        expect(rows[y]![x], `the growth built over ${row[x]} at ${x},${y}`).toBe(row[x])
      }
    }
  })

  it('mints every id past the ones the base had', () => {
    const after = grown.world.toJSON()
    const had = new Set([...base.doc.plots, ...base.doc.interiors, ...base.doc.npcs, ...base.doc.items].map((record) => record.id))
    const fresh = [...after.plots, ...after.interiors, ...after.npcs, ...after.items].slice(0).filter((record) => !had.has(record.id))
    expect(fresh.length, 'the growth added nothing').toBeGreaterThan(0)
    expect(after.plots.length + after.interiors.length + after.npcs.length + after.items.length).toBe(had.size + fresh.length)
    for (const counter of ['plot', 'interior', 'npc', 'item'] as const) {
      expect(after.idCounters[counter] ?? 0, `the ${counter} counter went backwards`).toBeGreaterThanOrEqual(base.doc.idCounters[counter] ?? 0)
    }
  })

  it('gives the same city twice from the same base and the same growth', async () => {
    const again = await grow(base, { blocks: 12, places: 2 })
    expect(JSON.stringify(again.world.toJSON())).toBe(JSON.stringify(grown.world.toJSON()))
    expect(JSON.stringify(again.quests)).toBe(JSON.stringify(grown.quests))
  })
})

describe('a growth writes work, not scenery', () => {
  it('writes quests that hold up, carrying on from the ids the base handed out', () => {
    expect(grown.quests.length, 'the growth wrote nothing to do').toBeGreaterThan(0)
    expect(grown.rejected, 'the growth wrote work it could not verify').toEqual([])
    const taken = new Set(base.quests.map((quest) => quest.id))
    for (const quest of grown.quests) expect(taken.has(quest.id), `${quest.id} collides with a quest the base hands out`).toBe(false)
    expect(grown.quests[0]!.id > base.quests.at(-1)!.id, 'the growth started its ids again').toBe(true)
  })

  it('sends the player back through the base city as well as into what just opened', () => {
    const grownPlots = new Set(grown.added)
    const opened = new Set([...openPlots(grown.world)].filter((plotId) => !openAtFirst.has(plotId)))
    const plotOf = new Map(grown.world.interiors().map((interior) => [interior.id, interior.plotId]))
    const standing = new Map(grown.world.npcs().flatMap((npc) => (npc.station ? [[npc.id, plotOf.get(npc.station.interiorId)!]] : [])))

    const givers = grown.quests.map((quest) => standing.get(quest.giverNpcId)!)
    expect(givers.every((plotId) => plotId !== undefined)).toBe(true)
    const fromBase = givers.filter((plotId) => !grownPlots.has(plotId) && !opened.has(plotId))
    const fromGrowth = givers.filter((plotId) => grownPlots.has(plotId) || opened.has(plotId))
    expect(fromBase.length + fromGrowth.length).toBe(givers.length)
    expect(fromGrowth.length, 'nobody the growth added has anything to say').toBeGreaterThan(0)
  })

  it('plays every one of them to the end', () => {
    const report = playEvery(grown.world, [...base.quests, ...grown.quests])
    const packed = playEvery(grown.world, grown.quests)
    expect(packed.stranded.map((run) => run.stranded).flat(), `the growth stranded a player: ${line(packed)}`).toEqual([])
    expect(packed.completable, `the growth's own work: ${line(packed)}`).toBe(packed.quests)
    expect(report.completable, `the whole city: ${line(report)}`).toBe(report.quests)
  })
})
