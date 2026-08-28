import { Forge } from '@gb/forge'
import { expect, it } from 'vitest'
import { SPEED_LIMIT } from '../src/settings.ts'
import { Traffic } from '../src/index.ts'

/**
 * The other tests build their own streets. This one drives what the generator
 * paints. It allows roadway or pavement rather than roadway alone, because the
 * generator lays each pavement band across the roadway it crosses, so a
 * junction approach in a generated city has pavement cells in the middle of it,
 * and it allows a car to be off the grid altogether once it is on the road out.
 */
it('drives a city straight out of the generator', () => {
  const planned = Forge.plan({ theme: 'harbour town', seed: 'traffic', blocksX: 3, blocksY: 3, blockCells: 14 })
  if (!planned.ok) throw new Error(JSON.stringify(planned.error).slice(0, 400))
  const world = planned.value

  const made = Traffic.fromWorld(world, { maxCars: 30 })
  expect(made.ok).toBe(true)
  if (!made.ok) return
  const traffic = made.value
  const focus = { x: 60, z: 60 }
  traffic.populate(focus)
  expect(traffic.count).toBeGreaterThan(10)

  const cell = (v: number) => Math.floor(v / world.cellSize)
  let leftTown = 0
  for (let frame = 0; frame < 900; frame++) {
    traffic.update(1 / 60, focus)
    for (const car of traffic.cars()) {
      const on = world.grid.at(cell(car.x), cell(car.z))
      if (on === undefined) leftTown++ // past the edge of the map, on the road out
      else expect(['street', 'sidewalk']).toContain(on)
      expect(car.speed).toBeLessThanOrEqual(SPEED_LIMIT.exit)
    }
  }
  expect(leftTown, 'nobody drove out of town').toBeGreaterThan(0)
})
