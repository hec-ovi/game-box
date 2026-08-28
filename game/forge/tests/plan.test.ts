import { inPlotBand, MAX_DISTRICTS, PLOT_BAND, plotShape, type Plot } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { districtCount, Forge } from '../src/index.ts'
import { stationsWanted } from '../src/layout/stations.ts'
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
    // the heights are the town's own skyline rather than a flat band
    expect(world.plots().some((plot) => plot.storeys > PLOT_BAND.storeys.max)).toBe(true)
  })

  it('carries no interiors, nobody and nothing, and holds together', () => {
    const world = planned('quay-9', brief('quay-9'))

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

  it('draws the same town twice from one brief', () => {
    expect(JSON.stringify(planned('quay-9', brief('quay-9')).toJSON())).toBe(JSON.stringify(planned('quay-9', brief('quay-9')).toJSON()))
  })

  it('draws the plan against a history somebody already wrote', () => {
    const world = planned('assize', brief('assize', { theme: 'quiet market town', blocksX: 4, blocksY: 4 }), LOCKUP)

    expect(world.premise()?.stake).toBe(LOCKUP.stake)
    expect(world.charters().map((charter) => charter.word)).toContain('jail')
    expect(world.plotsOfKind('jail').length, 'the town has no jail').toBeGreaterThan(0)
    // and a town planned without one is a different town
    expect(world.plots().map((plot) => plot.kind).join()).not.toBe(planned('assize', brief('assize', { theme: 'quiet market town', blocksX: 4, blocksY: 4 })).plots().map((plot) => plot.kind).join())
  })

  it('boards every five hundred metres, and never in exactly one place', () => {
    // a share of the plots put 26 entrances in an eight-block town and 157 in a twenty
    expect(stationsWanted(200, 0)).toBe(0)
    expect(stationsWanted(2500, 0)).toBe(5)

    const hamlet = planned('stations-2', { blocksX: 2, blocksY: 2 })
    expect(hamlet.stations().length, 'a town you cross in two minutes has a subway').toBe(0)

    const city = planned('stations-20', { blocksX: 20, blocksY: 20 })
    const span = Math.max(city.grid.width, city.grid.height) * city.cellSize
    expect(city.stations().length, `${Math.round(span)} m of city`).toBe(stationsWanted(span, 0))
    expect(city.stations().length).toBeGreaterThan(1)
    const apart = Math.min(
      ...city.stations().flatMap((a, at) => city.stations().slice(at + 1).map((b) => Math.hypot(a.entrance.cell.x - b.entrance.cell.x, a.entrance.cell.y - b.entrance.cell.y))),
    )
    expect(apart * city.cellSize, 'the stations are on one corner').toBeGreaterThan(300)
    for (const station of city.stations()) expect(city.charter(station.kind)?.transit).toBe('subway')

    // a history that says the town has a station gets one, and a second, because
    // a lone entrance is a travel panel with nowhere to ride to
    const told = planned('stations-told', { theme: 'quiet market town', blocksX: 3, blocksY: 3 }, UNDERGROUND)
    const small = Math.max(told.grid.width, told.grid.height) * told.cellSize
    expect(stationsWanted(small, 0), `${Math.round(small)} m of town: the spacing asks for none`).toBe(0)
    expect(told.stations().length, 'a demanded station is a station you can ride from').toBe(2)
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
