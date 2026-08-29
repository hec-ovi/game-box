import { inPlotBand, MAX_DISTRICTS, PLOT_BAND, plotShape, type Plot } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { districtCount, Forge } from '../src/index.ts'
import { townNeeds } from '../src/interior/needs.ts'
import { LOCKUP, UNDERGROUND } from './histories.ts'
import { planned } from './support.ts'

/**
 * The architecture of a city: what a brief gives before anybody writes a word of
 * it. `Forge.plan` is static and takes no narrator, so everything here runs with
 * no model anywhere near it.
 */

/** Whether a plot's footprint is one the building art is drawn for. Height is the one side of the band a skyline passes. */
const cutToBand = (plot: Plot): boolean => inPlotBand({ ...plotShape(plot), storeys: PLOT_BAND.storeys.min })

const brief = (seed: string, overrides: Record<string, unknown> = {}) => ({
  theme: 'dense neon port city',
  seed,
  blocksX: 6,
  blocksY: 6,
  ...overrides,
})

describe('Forge.plan', () => {
  it('lays the town out under placeholders, because naming is the writing and the writing comes after', () => {
    const world = planned('quay-9', brief('quay-9'))

    expect(world.name).toBe('City')
    expect(world.districts().map((zone) => zone.name)).toEqual(world.districts().map((_, at) => `Zone ${at + 1}`))
    expect(world.plots().map((plot) => plot.name)).toEqual(world.plots().map((_, at) => `Instance ${at + 1}`))
    // and nothing is a bar, a hotel or a station: what a building is belongs to the writing
    expect(new Set(world.plots().map((plot) => plot.kind))).toEqual(new Set(['building']))
    // the heights are the town's own skyline rather than a flat band
    expect(world.plots().some((plot) => plot.storeys > PLOT_BAND.storeys.max)).toBe(true)
  })

  it('carries no interiors, nobody and nothing, and holds together', () => {
    const world = planned('quay-9', brief('quay-9'))

    expect(world.check()).toEqual([])
    // every door on a plan is painted on: what is behind one follows from what
    // the place turns out to be, and nothing here has turned out to be anything
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
    // and it boards nowhere, because a station is a kind of place and no plan has one
    expect(world.stations()).toEqual([])
  })

  it('draws the same town twice from one brief', () => {
    expect(JSON.stringify(planned('quay-9', brief('quay-9')).toJSON())).toBe(JSON.stringify(planned('quay-9', brief('quay-9')).toJSON()))
  })

  it('carries the history it was drawn against, and puts none of it on a footprint', () => {
    const town = brief('assize', { theme: 'quiet market town', blocksX: 4, blocksY: 4 })
    const world = planned('assize', town, LOCKUP)

    expect(world.premise()?.stake).toBe(LOCKUP.stake)
    expect(world.charters().map((charter) => charter.word)).toContain('jail')
    // the kinds a history invents are the writing's to place, so the architecture
    // a history was handed is the architecture the same brief lays out without one
    expect(world.plotsOfKind('jail')).toEqual([])
    const bare = planned('assize', town)
    expect(world.plots().map((plot) => `${plot.rect.x},${plot.rect.y},${plot.storeys}`)).toEqual(bare.plots().map((plot) => `${plot.rect.x},${plot.rect.y},${plot.storeys}`))
  })

  it('asks the writing to board every five hundred metres, and never in exactly one place', () => {
    // where the trains board is a distance, not a share: a share of the plots put
    // 26 entrances in an eight-block town and 157 in a twenty. Nothing here places
    // one, because a station is a kind of place and those are the writing's
    const boards = (world: ReturnType<typeof planned>, premise?: Parameters<typeof townNeeds>[0]['premise']) =>
      townNeeds({
        places: 3,
        span: Math.max(world.grid.width, world.grid.height) * world.cellSize,
        charters: world.charters(),
        ...(premise ? { premise } : {}),
      }).find((need) => need.wants.includes('trains'))?.count ?? 0

    const hamlet = planned('stations-2', { blocksX: 2, blocksY: 2 })
    expect(boards(hamlet), 'a town you cross in two minutes is asked for a subway').toBe(0)
    expect(hamlet.stations()).toEqual([])

    const city = planned('stations-20', { blocksX: 20, blocksY: 20 })
    expect(boards(city), 'a kilometre of city is asked for one entrance or none').toBeGreaterThan(1)

    // a history that says the town has a station asks for one, and a second,
    // because a lone entrance is a travel panel with nowhere to ride to
    const told = planned('stations-told', { theme: 'quiet market town', blocksX: 3, blocksY: 3 }, UNDERGROUND)
    expect(boards(told), 'the spacing asks a town this small for none').toBe(0)
    expect(boards(told, told.premise()), 'a demanded station is a station you can ride from').toBe(2)
  })

  it('refuses a brief no world will hold, before a cell is allocated', () => {
    const out = Forge.plan({ theme: 'dense neon port city', seed: 'too-big', blocksX: 116, blocksY: 116 })

    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe('invalid-brief')
  })

  it('says how many parts a brief will be cut into, before anything is built', () => {
    expect(districtCount(1, 1)).toBe(1)
    expect(districtCount(200, 200)).toBe(MAX_DISTRICTS)

    const world = planned('quay-9', brief('quay-9', { blocksX: 10, blocksY: 10 }))
    // the planner sometimes leaves an inner street out and makes two blocks one,
    // so a town cuts at most what the brief's own blocks ask for
    expect(world.districts().length).toBeGreaterThan(0)
    expect(world.districts().length).toBeLessThanOrEqual(districtCount(10, 10))
  })
})
