import { inPlotBand, MAX_DISTRICTS, PLOT_BAND, plotShape, type Plot, type World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { districtCount, Forge, OfflineNarrator, type Narrator } from '../src/index.ts'
import { LOCKUP, Told } from './histories.ts'

/**
 * The architecture of a city: everything a plan promises to be the same as the
 * build it stands for. No name is in it. A plan is the architecture under its
 * placeholders and a build is the same architecture with the story written
 * over it, so what the two have to agree on is the shape of the town.
 */
function architecture(world: World) {
  const doc = world.toJSON()
  return {
    grid: doc.grid,
    roads: doc.roads,
    districts: world.districts().map((district) => ({ id: district.id, blocks: district.blocks })),
    stations: world.stations().map((plot) => plot.id),
    plots: world.plots().map((plot) => ({
      id: plot.id,
      kind: plot.kind,
      rect: plot.rect,
      entrance: plot.entrance,
      storeys: plot.storeys,
      district: plot.district,
      style: plot.style,
    })),
  }
}

/** Whether a plot's footprint is one the building art is drawn for. Height is the one side of the band a skyline passes. */
const cutToBand = (plot: Plot): boolean => inPlotBand({ ...plotShape(plot), storeys: PLOT_BAND.storeys.min })

const brief = (seed: string, overrides: Record<string, unknown> = {}) => ({
  theme: 'dense neon port city',
  seed,
  blocksX: 6,
  blocksY: 6,
  ...overrides,
})

/** A narrator nobody may ask anything: what a plan has to get through without. */
const asked = (): never => {
  throw new Error('a plan asked a narrator a question')
}
const silent: Narrator = {
  writePremise: asked,
  nameCity: asked,
  namePlace: asked,
  namePlaces: asked,
  nameDistricts: asked,
  describeNpc: asked,
  describeItem: asked,
  writeInstances: asked,
  writeQuests: asked,
}

const planned = async (forge: Forge, input: Record<string, unknown>, history?: unknown): Promise<World> => {
  const out = await forge.plan(input, history)
  if (!out.ok) throw new Error(JSON.stringify(out.error).slice(0, 400))
  return out.value
}

/** The same brief through both doors: built whole by an offline narrator, and planned. */
async function bothWays(seed: string, history?: unknown, overrides: Record<string, unknown> = {}) {
  const forge = new Forge(new Told(seed, history))
  const input = brief(seed, overrides)
  const built = await forge.build(input)
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return { built: built.value, plan: await planned(forge, input, history) }
}

describe('Forge.plan', () => {
  it('lays out the city the build puts up', async () => {
    const { built, plan } = await bothWays('quay-9')

    // the build really wrote a town, so this is a comparison and not two empty grids
    expect(built.world.interiors().length).toBeGreaterThan(0)
    expect(built.quests.length).toBeGreaterThan(0)
    expect(architecture(plan)).toEqual(architecture(built.world))
    // the heights are the town's own skyline rather than a flat band
    expect(plan.plots().some((plot) => plot.storeys > PLOT_BAND.storeys.max)).toBe(true)
  })

  it('draws the plan against a history the same way a build does', async () => {
    const { built, plan } = await bothWays('assize', LOCKUP, { theme: 'quiet market town', blocksX: 4, blocksY: 4, openPlaces: 6 })

    expect(plan.premise()?.stake).toBe(LOCKUP.stake)
    expect(plan.charters().map((charter) => charter.word)).toContain('jail')
    expect(architecture(plan)).toEqual(architecture(built.world))
  })

  it('lays the town out under placeholders, and writes its names over them once there is a story', async () => {
    // the order the owner asks for: the architecture is arithmetic and says so
    // in its own names, and the writing comes after it. A plan that composed
    // names would be inventing a town before anybody had written one
    const { built, plan } = await bothWays('quay-9')

    expect(plan.name).toBe('City')
    expect(plan.districts().map((zone) => zone.name)).toEqual(plan.districts().map((_, at) => `Zone ${at + 1}`))
    expect(plan.plots().map((plot) => plot.name)).toEqual(plan.plots().map((_, at) => `Instance ${at + 1}`))

    // and the same town built carries names instead, on all three
    expect(built.world.name).not.toBe('City')
    for (const zone of built.world.districts()) expect(zone.name, `${zone.id} was never named`).not.toMatch(/^Zone \d+$/)
    for (const plot of built.world.plots()) expect(plot.name, `${plot.id} was never named`).not.toMatch(/^Instance \d+$/)
    // the shapes are the same town, so it really is the same architecture named
    expect(architecture(plan)).toEqual(architecture(built.world))
  })

  it('carries no interiors, nobody and nothing, and holds together', async () => {
    const world = await planned(new Forge(new OfflineNarrator('quay-9')), brief('quay-9'))

    expect(world.check()).toEqual([])
    expect(world.interiors()).toEqual([])
    expect(world.npcs()).toEqual([])
    expect(world.items()).toEqual([])
    expect(world.placements()).toEqual([])
    expect(world.plots().every((plot) => plot.interiorId === undefined)).toBe(true)

    // and it is a town: every building on the map, in a part of it, cut to the sizes the art is drawn for
    expect(world.plots().length).toBeGreaterThan(100)
    expect(world.districts().length).toBeGreaterThan(0)
    expect(world.plots().every((plot) => plot.district !== undefined)).toBe(true)
    expect(world.plots().every(cutToBand)).toBe(true)
    expect(world.stations().length).toBeGreaterThan(0)
  })

  it('asks nobody anything', async () => {
    const world = await planned(new Forge(silent), brief('quay-9'))

    expect(world.plots().length).toBeGreaterThan(100)
  })

  it('refuses a brief no world will hold, before a cell is allocated', async () => {
    const out = await new Forge(silent).plan({ theme: 'dense neon port city', seed: 'too-big', blocksX: 116, blocksY: 116 })

    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('invalid-brief')
  })

  it('says how many parts a brief will be cut into, before anything is built', async () => {
    expect(districtCount(1, 1)).toBe(1)
    expect(districtCount(200, 200)).toBe(MAX_DISTRICTS)

    const world = await planned(new Forge(silent), brief('quay-9', { blocksX: 10, blocksY: 10 }))
    // the planner sometimes leaves an inner street out and makes two blocks one,
    // so a town cuts at most what the brief's own blocks ask for
    expect(world.districts().length).toBeGreaterThan(0)
    expect(world.districts().length).toBeLessThanOrEqual(districtCount(10, 10))
  })
})
