import { Forge, OfflineNarrator } from '@gb/forge'
import { expect, it } from 'vitest'
import { Traffic } from '../src/index.ts'

/**
 * The other tests build their own streets. This one drives what the generator
 * paints. It allows roadway or pavement rather than roadway alone, because the
 * generator lays each pavement band across the roadway it crosses, so a
 * junction approach in a generated city has pavement cells in the middle of it.
 */
it('drives a city straight out of the generator', async () => {
  const forge = new Forge(new OfflineNarrator('traffic'))
  const built = await forge.build({ theme: 'harbour town', seed: 'traffic', blocksX: 3, blocksY: 3, blockCells: 14 })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  const world = built.value.world

  const made = Traffic.fromWorld(world, { maxCars: 30 })
  expect(made.ok).toBe(true)
  if (!made.ok) return
  const traffic = made.value
  const focus = { x: 60, z: 60 }
  traffic.populate(focus)
  expect(traffic.count).toBeGreaterThan(10)

  const cell = (v: number) => Math.floor(v / world.cellSize)
  for (let frame = 0; frame < 900; frame++) {
    traffic.update(1 / 60, focus)
    for (const car of traffic.cars()) {
      expect(['street', 'sidewalk']).toContain(world.grid.at(cell(car.x), cell(car.z)))
      expect(car.speed).toBeLessThanOrEqual(9.5) // the 8.5 m/s street limit, plus the boldest driver's margin
    }
  }
})
