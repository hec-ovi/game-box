import { METRICS, PLOT_BAND } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { everyBucket } from '../src/bucket.ts'
import { InvalidCatalogue } from '../src/catalogue.ts'
import { catalogueOf, plotOf } from './support.ts'

describe('the catalogue', () => {
  it('expects exactly the shapes the city is cut in, in metres', () => {
    const shapes = everyBucket()
    const cells = (range: { min: number; max: number }) => range.max - range.min + 1
    expect(shapes).toHaveLength(cells(PLOT_BAND.frontage) * cells(PLOT_BAND.depth) * cells(PLOT_BAND.storeys))
    expect(new Set(shapes.map((shape) => shape.front))).toEqual(new Set([6, 8, 10, 12].map((cellsAcross) => (cellsAcross / 2) * METRICS.cellSize)))
    expect(Math.min(...shapes.map((shape) => shape.depth))).toBe(PLOT_BAND.depth.min * METRICS.cellSize)
    expect(Math.max(...shapes.map((shape) => shape.storeys))).toBe(PLOT_BAND.storeys.max)
  })

  it('refuses anything that is not a manifest', () => {
    expect(() => catalogueOf({ models: [] })).toThrow(InvalidCatalogue)
    expect(() => catalogueOf({ sha256: 'not a hash' })).toThrow(InvalidCatalogue)
  })

  it('gives a plot a model of its own shape', () => {
    const design = catalogueOf().design(plotOf(), { width: 8, depth: 12 })
    expect(design?.model).toMatch(/8x12x2$/)
  })

  it('reads the shape in the door’s frame, so a turned plot is the same shape', () => {
    const catalogue = catalogueOf()
    const facing = catalogue.design(plotOf({ entrance: { cell: { x: 6, y: 3 }, facing: 'north' } }), { width: 8, depth: 12 })
    const turned = catalogue.design(plotOf({ rect: { x: 4, y: 4, w: 6, h: 4 }, entrance: { cell: { x: 3, y: 6 }, facing: 'west' } }), { width: 12, depth: 8 })
    expect(facing?.model).toBe(turned?.model)
  })

  it('gives the same plot the same building however often it is asked', () => {
    const catalogue = catalogueOf()
    const answers = new Set(Array.from({ length: 20 }, () => JSON.stringify(catalogue.design(plotOf(), { width: 8, depth: 12 }))))
    expect(answers.size).toBe(1)
  })

  it('does not give every plot the same building', () => {
    const catalogue = catalogueOf()
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => catalogue.design(plotOf({ id: `plot_${i}`, kind: 'chapel' }), { width: 8, depth: 12 })?.model),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('gives a trade a model that claims it, and the whole shape when none does', () => {
    const catalogue = catalogueOf()
    for (let i = 0; i < 20; i++) {
      expect(catalogue.design(plotOf({ id: `plot_${i}`, kind: 'house' }), { width: 8, depth: 12 })?.model).toBe('home-8x12x2')
    }
    // nothing claims a chapel, so the whole shape answers rather than nothing
    expect(catalogue.design(plotOf({ kind: 'chapel' }), { width: 8, depth: 12 })).toBeDefined()
    // and a trade two looks claim draws from both
    const shops = new Set(Array.from({ length: 30 }, (_, i) => catalogue.design(plotOf({ id: `s_${i}`, kind: 'shop' }), { width: 8, depth: 12 })?.model))
    expect([...shops].sort()).toEqual(['shop-8x12x2', 'works-8x12x2'])
  })

  it('starts two plots on one model at different rooms', () => {
    const catalogue = catalogueOf()
    const rooms = Array.from({ length: 40 }, (_, i) => catalogue.design(plotOf({ id: `plot_${i}`, kind: 'house' }), { width: 8, depth: 12 }))
    expect(new Set(rooms.map((design) => design?.model))).toEqual(new Set(['home-8x12x2']))
    expect(new Set(rooms.map((design) => design?.rooms)).size).toBeGreaterThan(8)
  })

  it('says nothing for a shape it does not hold, so the kit can answer', () => {
    expect(catalogueOf().design(plotOf({ storeys: 9 }), { width: 8, depth: 12 })).toBeUndefined()
    expect(catalogueOf().design(plotOf(), { width: 30, depth: 12 })).toBeUndefined()
  })

  it('names the shapes it is missing', () => {
    const answer = catalogueOf().covers([
      { front: 8, depth: 12, storeys: 2 },
      { front: 6, depth: 12, storeys: 2 },
    ])
    expect(answer.ok).toBe(false)
    expect(answer.ok === false && answer.missing).toEqual([{ front: 6, depth: 12, storeys: 2 }])
  })
})
