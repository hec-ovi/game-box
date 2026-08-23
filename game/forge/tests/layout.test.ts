import { Rng } from '@gb/kit'
import type { CellKind, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { briefContract, Forge, MOUNTAIN_CELLS, OfflineNarrator, SIDEWALK_CELLS, STREET_CELLS } from '../src/index.ts'
import { planStreets } from '../src/layout/plan.ts'
import { cutsFourWays } from '../src/layout/plots.ts'
import { buildTown, digest } from './support.ts'

const HALF = Math.floor(STREET_CELLS / 2)
const BAND = STREET_CELLS + SIDEWALK_CELLS * 2

interface Cell {
  x: number
  y: number
}

/** Every cell the road graph claims: each segment's centreline, and the roadway around it. */
function roadway(world: World): { centres: Cell[]; cells: Cell[] } {
  const { nodes, segments } = world.toJSON().roads
  const cellOf = (id: string) => nodes.find((node) => node.id === id)!.cell
  const centres = new Map<string, Cell>()
  const cells = new Map<string, Cell>()

  for (const segment of segments) {
    const from = cellOf(segment.from)
    const to = cellOf(segment.to)
    const step = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) }
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
    for (let i = 0; i <= length; i++) {
      const centre = { x: from.x + step.x * i, y: from.y + step.y * i }
      centres.set(`${centre.x},${centre.y}`, centre)
      for (let n = -HALF; n <= HALF; n++) {
        const cell = step.x === 0 ? { x: centre.x + n, y: centre.y } : { x: centre.x, y: centre.y + n }
        cells.set(`${cell.x},${cell.y}`, cell)
      }
    }
  }
  return { centres: [...centres.values()], cells: [...cells.values()] }
}

/** The town without its buildings: streets, pavement, squares and mountains. */
function skeleton(world: World): string {
  return world.grid
    .rows()
    .map((row) => row.replace(/B/g, '.'))
    .join('\n')
}

/** Is there an open square in this town, this many cells across? Wider than any street band. */
function hasSquare(world: World, side: number): boolean {
  const open = (x: number, y: number) => {
    const kind = world.grid.at(x, y)
    return kind === 'park' || kind === 'sidewalk'
  }
  for (let y = 0; y + side <= world.grid.height; y++) {
    for (let x = 0; x + side <= world.grid.width; x++) {
      let all = true
      for (let dy = 0; all && dy < side; dy++) for (let dx = 0; dx < side; dx++) if (!open(x + dx, y + dy)) { all = false; break }
      if (all) return true
    }
  }
  return false
}

describe('the street plan', () => {
  it('paints junctions like junctions: roadway right through, pavement only on the corners', async () => {
    const { world } = await buildTown('junctions', { exits: 4 })
    const { centres, cells } = roadway(world)
    const kindsAt = (list: Cell[]) => new Set<CellKind | undefined>(list.map((cell) => world.grid.at(cell.x, cell.y)))

    // a car drives the whole graph without meeting a 15 cm kerb, and no pavement sits on the roadway
    expect(centres.length).toBeGreaterThan(200)
    expect([...kindsAt(centres)]).toEqual(['street'])
    expect([...kindsAt(cells)]).toEqual(['street'])

    // and nowhere in town is there a pavement cell with roadway on both sides of it,
    // which is a street lamp standing in the middle of the road
    const stranded: string[] = []
    for (let y = 1; y < world.grid.height - 1; y++) {
      for (let x = 1; x < world.grid.width - 1; x++) {
        if (world.grid.at(x, y) !== 'sidewalk') continue
        const road = (dx: number, dy: number) => world.grid.at(x + dx, y + dy) === 'street'
        if ((road(-1, 0) && road(1, 0)) || (road(0, -1) && road(0, 1))) stranded.push(`${x},${y}`)
      }
    }
    expect(stranded).toEqual([])

    // the pavement is still there: every crossing keeps a corner of it in each quarter
    const { nodes, segments } = world.toJSON().roads
    const crossings = nodes.filter((node) => segments.filter((s) => s.from === node.id || s.to === node.id).length > 1)
    expect(crossings.length).toBeGreaterThan(3)
    for (const node of crossings) {
      for (const dx of [-(HALF + 1), HALF + 1]) {
        for (const dy of [-(HALF + 1), HALF + 1]) {
          const corner = { x: node.cell.x + dx, y: node.cell.y + dy }
          expect(world.grid.at(corner.x, corner.y), `corner at ${corner.x},${corner.y}`).toBe('sidewalk')
        }
      }
    }
  })

  it('cuts blocks so buildings face all four ways', async () => {
    // whatever size the seed picks, a block is deep enough for doors on its east and west sides
    for (const seed of ['facings', 'ash', 'birch', 'cedar']) {
      const plan = planStreets({ blocksX: 3, blocksY: 3 }, new Rng(seed).fork('streets'))
      for (const block of plan.blocks) {
        expect(cutsFourWays(Math.min(block.w, block.h)), `${seed}: a ${block.w}x${block.h} block`).toBe(true)
      }
    }

    const { world } = await buildTown('facings')
    const facing = (which: string) => world.plots().filter((plot) => plot.entrance.facing === which).length
    for (const which of ['north', 'south', 'east', 'west']) {
      expect(facing(which), `${which}-facing doors`).toBeGreaterThan(0)
    }
  })

  it('reads as a different town for a different seed', async () => {
    const seeds = ['ash', 'birch', 'cedar', 'dune', 'elm', 'fir']
    const towns = await Promise.all(seeds.map((seed) => buildTown(seed)))

    expect(new Set(towns.map((town) => skeleton(town.world))).size).toBe(seeds.length)
    expect(new Set(towns.map((town) => digest(town.world.toJSON().roads))).size).toBe(seeds.length)
    // block sizes differ, so the towns are not one grid at different scales
    expect(new Set(towns.map((town) => `${town.world.grid.width}x${town.world.grid.height}`)).size).toBeGreaterThan(3)
    // and some of them leave a block open as a square or a green
    expect(towns.some((town) => hasSquare(town.world, BAND * 2 + 1))).toBe(true)
  })

  it('lays the blocks the brief asked for when it asks', async () => {
    const { world } = await buildTown('pinned', { blocksX: 1, blocksY: 1, blockCells: 30 })
    const around = (cells: number) => MOUNTAIN_CELLS * 2 + BAND * 2 + cells

    expect(world.grid.width).toBeGreaterThanOrEqual(around(28))
    expect(world.grid.width).toBeLessThanOrEqual(around(33))
  })

  it('refuses a brief that asks for more city than a world can hold', async () => {
    // the brief says no on its own, before a single cell is allocated
    const big = briefContract.parse({ theme: 'sprawl', seed: 'too-big', blocksX: 24, blocksY: 1, blockCells: 40 })
    expect(big.ok).toBe(false)
    if (!big.ok) expect(big.error[0]!.message).toContain('1024')

    const wordy = briefContract.parse({ theme: 'a rain-soaked port city '.repeat(4), seed: 'wordy' })
    expect(wordy.ok).toBe(false)
    if (!wordy.ok) expect(wordy.error[0]!.path).toBe('theme')

    // and the forge hands it back as an error instead of throwing out of a world constructor
    const built = await new Forge(new OfflineNarrator('too-big')).build({
      theme: 'sprawl',
      seed: 'too-big',
      blocksX: 24,
      blocksY: 1,
      blockCells: 40,
    })
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.error.code).toBe('invalid-brief')
  })
})
