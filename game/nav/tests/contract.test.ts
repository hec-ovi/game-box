import { Forge, OfflineNarrator } from '@gb/forge'
import { World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { CityNav } from '../src/index.ts'

async function town() {
  const forge = new Forge(new OfflineNarrator('nav'))
  const built = await forge.build({ theme: 'river town', seed: 'nav', blocksX: 2, blocksY: 2, blockCells: 14 })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value.world
}

describe('CityNav', () => {
  it('walks from one doorstep to another across the city', async () => {
    const world = await town()
    const nav = CityNav.from(world)
    const [first, last] = [world.plots()[0]!, world.plots()[world.plots().length - 1]!]

    const path = nav.path(first.entrance.cell, last.entrance.cell)
    expect(path).toBeDefined()
    if (!path) return

    expect(path[0]).toEqual(first.entrance.cell)
    expect(path[path.length - 1]).toEqual(last.entrance.cell)
    // every step is to a neighbouring, walkable cell
    for (let i = 1; i < path.length; i++) {
      const step = { dx: Math.abs(path[i]!.x - path[i - 1]!.x), dy: Math.abs(path[i]!.y - path[i - 1]!.y) }
      expect(step.dx).toBeLessThanOrEqual(1)
      expect(step.dy).toBeLessThanOrEqual(1)
      expect(nav.walkable(path[i]!)).toBe(true)
    }
  })

  it('never routes through a building or a mountain', async () => {
    const world = await town()
    const nav = CityNav.from(world)
    const plots = world.plots()

    const path = nav.path(plots[0]!.entrance.cell, plots[Math.floor(plots.length / 2)]!.entrance.cell)!
    for (const cell of path) {
      expect(['building', 'mountain', 'water']).not.toContain(world.grid.at(cell.x, cell.y))
    }
    expect(nav.walkable({ x: 0, y: 0 })).toBe(false)
    expect(nav.path(plots[0]!.entrance.cell, { x: 0, y: 0 })).toBeUndefined()
  })

  it('prefers the sidewalk and only crosses the road when it pays', async () => {
    const world = await town()
    const nav = CityNav.from(world)
    const plots = world.plots()
    const path = nav.path(plots[0]!.entrance.cell, plots[1]!.entrance.cell)!

    const kinds = path.map((c) => world.grid.at(c.x, c.y))
    const sidewalk = kinds.filter((k) => k === 'sidewalk').length
    const street = kinds.filter((k) => k === 'street').length
    expect(sidewalk).toBeGreaterThan(street)
  })

  it('collapses a route to its corners, in metres', async () => {
    const world = await town()
    const nav = CityNav.from(world)
    const plots = world.plots()
    const path = nav.path(plots[0]!.entrance.cell, plots[plots.length - 1]!.entrance.cell)!

    const waypoints = nav.waypoints(path)
    expect(waypoints.length).toBeGreaterThan(1)
    expect(waypoints.length).toBeLessThan(path.length)
    // metres, not cells
    expect(waypoints[0]!.x).toBeCloseTo((path[0]!.x + 0.5) * world.cellSize)
    expect(waypoints[0]!.z).toBeCloseTo((path[0]!.y + 0.5) * world.cellSize)
  })

  it('answers reachability, which is what "go there" objectives depend on', async () => {
    const world = await town()
    const nav = CityNav.from(world)
    const doorsteps = world.plots().map((p) => p.entrance.cell)

    for (const doorstep of doorsteps) {
      expect(nav.reachable(doorsteps[0]!, doorstep)).toBe(true)
    }
    expect(nav.reachable(doorsteps[0]!, { x: 1, y: 1 })).toBe(false)
  })

  it('walks to a building by id', async () => {
    const world = await town()
    const nav = CityNav.from(world)
    const bar = world.plotsOfKind('bar')[0]!

    const path = nav.pathToDoor(world, world.plots()[0]!.entrance.cell, bar.id)
    expect(path).toBeDefined()
    expect(path![path!.length - 1]).toEqual(bar.entrance.cell)
    expect(nav.pathToDoor(world, world.plots()[0]!.entrance.cell, 'plot_9999')).toBeUndefined()
  })

  it('handles a city with nowhere to walk without hanging', () => {
    const walled = World.create({ name: 'Sealed', theme: 'test', seed: 'sealed', width: 8, height: 8 })
    walled.paint({ x: 0, y: 0, w: 8, h: 8 }, 'mountain')
    const nav = CityNav.from(walled)
    expect(nav.path({ x: 1, y: 1 }, { x: 6, y: 6 })).toBeUndefined()
  })
})
