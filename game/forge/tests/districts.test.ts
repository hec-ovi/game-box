import type { District, Rect, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { planned } from './support.ts'

/**
 * The parts a city is cut into.
 *
 * `docs/CITY.md` section 3 makes the district the unit between the city and a
 * plot, and the owner's rule is that a district is a group of blocks rather
 * than a square: an L, a Z or a T, with every part of the map inside one. All
 * three are measured here on a real city rather than on a fixture, because the
 * cut is only worth anything if the town the generator actually builds comes
 * out that way.
 */

/**
 * The town's blocks as a lattice: every block by its column and its row among
 * the street lines. Two blocks are next to each other exactly when they are
 * next to each other in it, which is what "you can walk from one to the other"
 * means on a grid of streets.
 */
class Lattice {
  readonly #cols: readonly number[]
  readonly #rows: readonly number[]

  constructor(blocks: readonly Rect[]) {
    this.#cols = [...new Set(blocks.map((block) => block.x))].sort((a, b) => a - b)
    this.#rows = [...new Set(blocks.map((block) => block.y))].sort((a, b) => a - b)
  }

  cell(block: Rect): { col: number; row: number } {
    return { col: this.#cols.indexOf(block.x), row: this.#rows.indexOf(block.y) }
  }

  /** Whether every block of a district is reachable from the first through blocks of that district. */
  contiguous(district: District): boolean {
    const cells = district.blocks.map((block) => this.cell(block))
    const held = new Set(cells.map((cell) => `${cell.col},${cell.row}`))
    const seen = new Set([`${cells[0]!.col},${cells[0]!.row}`])
    const queue = [cells[0]!]
    for (let at = 0; at < queue.length; at++) {
      const { col, row } = queue[at]!
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        const key = `${col + dx},${row + dy}`
        if (held.has(key) && !seen.has(key)) {
          seen.add(key)
          queue.push({ col: col + dx, row: row + dy })
        }
      }
    }
    return seen.size === cells.length
  }

  /** Whether a district fills its own bounding box, which is what it means for it to be one rectangle. */
  rectangle(district: District): boolean {
    const cells = district.blocks.map((block) => this.cell(block))
    const cols = cells.map((cell) => cell.col)
    const rows = cells.map((cell) => cell.row)
    const across = Math.max(...cols) - Math.min(...cols) + 1
    const down = Math.max(...rows) - Math.min(...rows) + 1
    return across * down === cells.length
  }
}

const allBlocks = (world: World): Rect[] => world.districts().flatMap((district) => district.blocks)

describe('the parts a city is cut into', () => {
  it('holds every block of the town in exactly one district, each of them one piece you can walk across', () => {
    const world = planned('districts-1', { blocksX: 20, blocksY: 20 })
    const districts = world.districts()
    expect(districts.length).toBeGreaterThan(1)

    // nothing is left over and nothing is in two: the owner's "all zones must
    // be filled in the map", counted block by block
    const held = allBlocks(world).map((block) => `${block.x},${block.y}`)
    expect(new Set(held).size).toBe(held.length)

    // and the whole town is inside them: every plot stands on a block of the district it names
    const byId = new Map(districts.map((district) => [district.id, district]))
    for (const plot of world.plots()) {
      const district = plot.district ? byId.get(plot.district) : undefined
      expect(district, `${plot.name} stands in no district`).toBeDefined()
      expect(district!.blocks.some((block) => inside(plot.rect, block)), `${plot.name} is outside ${district!.name}`).toBe(true)
    }

    const lattice = new Lattice(allBlocks(world))
    for (const district of districts) {
      expect(district.blocks.length, `${district.name} holds nothing`).toBeGreaterThan(0)
      expect(lattice.contiguous(district), `${district.name} is in two pieces`).toBe(true)
    }
  })

  it('cuts shapes that are not rectangles', () => {
    const world = planned('districts-1', { blocksX: 20, blocksY: 20 })
    const lattice = new Lattice(allBlocks(world))
    const ragged = world.districts().filter((district) => !lattice.rectangle(district))
    expect(ragged.length, 'every district came out a rectangle').toBeGreaterThan(0)
  })

  it('stands every plot in a district the city has cut, and can say which one off a plot id', () => {
    const world = planned('districts-2', { blocksX: 8, blocksY: 8 })
    const ids = new Set(world.districts().map((district) => district.id))

    expect(world.plots().every((plot) => plot.district && ids.has(plot.district))).toBe(true)
    expect(world.district(world.plots()[0]!.id)?.name).toBe(world.districts().find((one) => one.id === world.plots()[0]!.district)?.name)
  })
})

const inside = (rect: Rect, block: Rect): boolean =>
  rect.x >= block.x && rect.y >= block.y && rect.x + rect.w <= block.x + block.w && rect.y + rect.h <= block.y + block.h
