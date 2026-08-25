import { Forge, OfflineNarrator } from '@gb/forge'
import { World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { CityNav, type Cell } from '../src/index.ts'

async function town() {
  const forge = new Forge(new OfflineNarrator('nav'))
  const built = await forge.build({ theme: 'river town', seed: 'nav', blocksX: 2, blocksY: 2, blockCells: 14 })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value.world
}

/** A hundred door-to-door questions, always the same hundred. */
function questions(doors: readonly Cell[]): Array<[Cell, Cell]> {
  const pairs: Array<[Cell, Cell]> = []
  for (let i = 0; i < 100; i++) {
    pairs.push([doors[(i * 7) % doors.length]!, doors[(i * 13 + 3) % doors.length]!])
  }
  return pairs
}

let world: Awaited<ReturnType<typeof town>>

beforeAll(async () => {
  world = await town()
})

describe('CityNav', () => {
  it('walks from one doorstep to another across the city', () => {
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

  it('never routes through a building or a mountain', () => {
    const nav = CityNav.from(world)
    const plots = world.plots()

    const path = nav.path(plots[0]!.entrance.cell, plots[Math.floor(plots.length / 2)]!.entrance.cell)!
    for (const cell of path) {
      expect(['building', 'mountain', 'water']).not.toContain(world.grid.at(cell.x, cell.y))
    }
    expect(nav.walkable({ x: 0, y: 0 })).toBe(false)
    expect(nav.path(plots[0]!.entrance.cell, { x: 0, y: 0 })).toBeUndefined()
  })

  it('prefers the sidewalk and only crosses the road when it pays', () => {
    const nav = CityNav.from(world)
    const plots = world.plots()
    const path = nav.path(plots[0]!.entrance.cell, plots[1]!.entrance.cell)!

    const kinds = path.map((c) => world.grid.at(c.x, c.y))
    const sidewalk = kinds.filter((k) => k === 'sidewalk').length
    const street = kinds.filter((k) => k === 'street').length
    expect(sidewalk).toBeGreaterThan(street)
  })

  it('takes the cheapest walk there is, not merely a walk', () => {
    const nav = CityNav.from(world)
    const doors = world.plots().map((p) => p.entrance.cell)
    const oracle = cheapestWalks(world, doors[0]!)

    for (const door of doors) {
      const path = nav.path(doors[0]!, door)!
      expect(priceOf(world, path)).toBeCloseTo(oracle.get(key(world, door))!, 6)
    }
  })

  it('takes a cost override at its word, and still finds the cheapest walk under it', () => {
    // a short sidewalk straight there, and a long way round through the park
    const park = World.create({ name: 'Park', theme: 'test', seed: 'park', width: 16, height: 16 })
    park.paint({ x: 0, y: 0, w: 16, h: 16 }, 'mountain')
    park.paint({ x: 0, y: 8, w: 16, h: 1 }, 'sidewalk')
    park.paint({ x: 0, y: 1, w: 1, h: 7 }, 'park')
    park.paint({ x: 0, y: 1, w: 16, h: 1 }, 'park')
    park.paint({ x: 15, y: 1, w: 1, h: 7 }, 'park')
    const from = { x: 0, y: 8 }
    const to = { x: 15, y: 8 }

    // park at 1.2 makes the long way round dearer, so the walk goes straight
    expect(CityNav.from(park).path(from, to)!.every((c) => c.y === 8)).toBe(true)
    // at 0.2 the long way round is cheaper, and a heuristic priced at the sidewalk would miss it
    expect(CityNav.from(park, { park: 0.2 }).path(from, to)!.some((c) => c.y === 1)).toBe(true)
  })

  it('collapses a route to its corners, in metres', () => {
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

  it('answers reachability, which is what "go there" objectives depend on', () => {
    const nav = CityNav.from(world)
    const doorsteps = world.plots().map((p) => p.entrance.cell)

    for (const doorstep of doorsteps) {
      expect(nav.reachable(doorsteps[0]!, doorstep)).toBe(true)
      expect(nav.reachable(doorsteps[0]!, doorstep)).toBe(nav.path(doorsteps[0]!, doorstep) !== undefined)
    }
    expect(nav.reachable(doorsteps[0]!, { x: 1, y: 1 })).toBe(false)
  })

  it('walks to a building by id', () => {
    const nav = CityNav.from(world)
    const plots = world.plots()
    const target = plots[plots.length - 1]!

    const path = nav.pathToDoor(world, plots[0]!.entrance.cell, target.id)
    expect(path).toBeDefined()
    expect(path![path!.length - 1]).toEqual(target.entrance.cell)
    expect(nav.pathToDoor(world, world.plots()[0]!.entrance.cell, 'plot_9999')).toBeUndefined()
  })

  it('handles a city with nowhere to walk without hanging', () => {
    const walled = World.create({ name: 'Sealed', theme: 'test', seed: 'sealed', width: 8, height: 8 })
    walled.paint({ x: 0, y: 0, w: 8, h: 8 }, 'mountain')
    const nav = CityNav.from(walled)
    expect(nav.path({ x: 1, y: 1 }, { x: 6, y: 6 })).toBeUndefined()
    expect(nav.reachableFrom({ x: 1, y: 1 }).cells).toBe(0)
  })
})

describe('reused scratch space', () => {
  it('gives one searcher the same answers a hundred fresh ones would', () => {
    const doors = world.plots().map((p) => p.entrance.cell)
    const pairs = questions(doors)
    // the reference: every question answered by a searcher that has never searched before
    const alone = pairs.map(([from, to]) => CityNav.from(world).path(from, to))

    const shared = CityNav.from(world)
    for (let round = 0; round < 2; round++) {
      pairs.forEach(([from, to], i) => {
        expect(shared.path(from, to)).toEqual(alone[i])
      })
    }
  })

  it('answers the same question twice the same way, however much ran in between', () => {
    const doors = world.plots().map((p) => p.entrance.cell)
    const nav = CityNav.from(world)
    const first = nav.path(doors[0]!, doors[doors.length - 1]!)

    for (const [from, to] of questions(doors)) nav.path(from, to)
    expect(nav.path(doors[0]!, doors[doors.length - 1]!)).toEqual(first)
  })
})

describe('reachableFrom', () => {
  it('answers every plot in the city in one pass, exactly as asking one by one would', () => {
    const nav = CityNav.from(world)
    const start = world.plots()[0]!.entrance.cell
    const reach = nav.reachableFrom(start)

    for (const plot of world.plots()) {
      expect(reach.reachesPlot(world, plot.id)).toBe(nav.reachable(start, plot.entrance.cell))
    }
    expect(reach.unreachablePlots(world)).toEqual([])
    expect(reach.from).toEqual(start)
    expect(reach.cells).toBeGreaterThan(0)
  })

  it('agrees with a route for arbitrary cells, walkable or not', () => {
    const nav = CityNav.from(world)
    const start = world.plots()[0]!.entrance.cell
    const reach = nav.reachableFrom(start)

    for (let y = 0; y < world.grid.height; y += 3) {
      for (let x = 0; x < world.grid.width; x += 3) {
        expect(reach.reaches({ x, y })).toBe(nav.reachable(start, { x, y }))
      }
    }
    expect(reach.reaches({ x: -1, y: 0 })).toBe(false)
    expect(reach.reaches({ x: world.grid.width, y: 0 })).toBe(false)
  })

  it('names the buildings walled off from the start', () => {
    const island = World.create({ name: 'Island', theme: 'test', seed: 'island', width: 16, height: 16 })
    island.paint({ x: 0, y: 0, w: 16, h: 16 }, 'sidewalk')
    island.paint({ x: 8, y: 0, w: 1, h: 16 }, 'mountain')
    const nav = CityNav.from(island)
    const reach = nav.reachableFrom({ x: 2, y: 2 })

    expect(reach.reaches({ x: 6, y: 9 })).toBe(true)
    expect(reach.reaches({ x: 12, y: 9 })).toBe(false)
    expect(reach.reaches({ x: 8, y: 9 })).toBe(false)
    expect(reach.cells).toBe(8 * 16)
    expect(reach.reachesPlot(island, 'plot_9999')).toBe(false)
  })

  it('reaches nothing at all from ground you cannot stand on', () => {
    const nav = CityNav.from(world)
    const reach = nav.reachableFrom({ x: 0, y: 0 })
    expect(reach.cells).toBe(0)
    expect(reach.reaches({ x: 0, y: 0 })).toBe(false)
  })
})

/** Cheapest walk from `start` to every cell, by plain Dijkstra: the oracle A* has to match. */
function cheapestWalks(w: World, start: Cell): Map<string, number> {
  const price = (c: Cell) => {
    const kind = w.grid.at(c.x, c.y)
    if (!kind) return Number.POSITIVE_INFINITY
    return { sidewalk: 1, park: 1.2, empty: 1.6, street: 3 }[kind as 'sidewalk'] ?? Number.POSITIVE_INFINITY
  }
  const best = new Map<string, number>([[key(w, start), 0]])
  const open: Array<[Cell, number]> = [[start, 0]]
  while (open.length) {
    open.sort((a, b) => a[1] - b[1])
    const [cell, cost] = open.shift()!
    if (cost > (best.get(key(w, cell)) ?? Number.POSITIVE_INFINITY)) continue
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const next = { x: cell.x + dx, y: cell.y + dy }
      if (!Number.isFinite(price(next))) continue
      if (dx !== 0 && dy !== 0) {
        if (!Number.isFinite(price({ x: next.x, y: cell.y }))) continue
        if (!Number.isFinite(price({ x: cell.x, y: next.y }))) continue
      }
      const stride = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1
      const total = cost + price(next) * stride
      if (total >= (best.get(key(w, next)) ?? Number.POSITIVE_INFINITY)) continue
      best.set(key(w, next), total)
      open.push([next, total])
    }
  }
  return best
}

function priceOf(w: World, path: readonly Cell[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const step = path[i]!
    const previous = path[i - 1]!
    const stride = step.x !== previous.x && step.y !== previous.y ? Math.SQRT2 : 1
    const kind = w.grid.at(step.x, step.y)!
    total += ({ sidewalk: 1, park: 1.2, empty: 1.6, street: 3 }[kind as 'sidewalk'] ?? 0) * stride
  }
  return total
}

function key(w: World, cell: Cell): string {
  return `${cell.y * w.grid.width + cell.x}`
}
