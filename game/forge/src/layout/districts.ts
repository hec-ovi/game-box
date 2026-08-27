import type { Rng } from '@gb/kit'
import { MAX_DISTRICTS, type Rect } from '@gb/world'

/**
 * Blocks across a district: about seven, which at ordinary block sizes is
 * around 400 m, five minutes on foot and about the spacing the stations are
 * set at. A district is a piece of town a player crosses and holds as one
 * place, so what grows with the city is the number of districts rather than
 * their size: a 2 block hamlet is one district, a 10 by 10 town two, a 20 by
 * 20 city six to eight, which is the handful `docs/CITY.md` asks for. Past
 * `MAX_DISTRICTS` they get bigger instead of more numerous, because a map
 * carrying more labels than a person holds in their head is a map of labels.
 */
const BLOCKS_ACROSS = 7

/** How many parts a town of this many blocks is cut into. */
export function districtsWanted(blocks: number): number {
  return Math.max(1, Math.min(MAX_DISTRICTS, Math.round(blocks / (BLOCKS_ACROSS * BLOCKS_ACROSS))))
}

/**
 * How many parts a brief's town is cut into, off the blocks it asks for, so a
 * form can say how many parts a city will have before anything is built. It is
 * the rule and not a promise about one town: the planner sometimes leaves an
 * inner street out and makes two blocks one, so a real town cuts a few blocks
 * fewer than the brief names and can come out a district short. The exact
 * number is `Forge.plan`'s, on `world.districts()`.
 */
export function districtCount(blocksX: number, blocksY: number): number {
  return districtsWanted(blocksX * blocksY)
}

/** Which way a part of town lies from the middle of it: how a name is placed without naming a metre. */
export const BEARINGS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'middle'] as const

export type Bearing = (typeof BEARINGS)[number]

/** One part of the city as the cut leaves it. */
export interface DistrictCut {
  /** Which of the town's blocks it holds, as indexes into the list it was cut from. */
  readonly blocks: readonly number[]
  /** Which way it lies from the middle of town. */
  readonly bearing: Bearing
}

/**
 * Cuts a town's blocks into contiguous, irregular districts.
 *
 * A few blocks spread across the town are taken as starting points, one per
 * connected piece of the town at least, and then each district takes an
 * unclaimed block off its own edge, one at a time, in turn, until nothing is
 * left. Which block it takes is drawn from its own stream, which is what makes
 * the shapes ragged: a district comes out an L, a Z or a T rather than a
 * rectangle, because nothing here ever cuts a box.
 *
 * Two things hold whatever the seed does. Every block ends up in exactly one
 * district, because a district only ever claims an unclaimed block and a block
 * next to a claimed one is always on somebody's edge. And every district is
 * contiguous, because it only ever grows onto a block touching one it already
 * holds.
 */
export function cutDistricts(blocks: readonly Rect[], rng: Rng): DistrictCut[] {
  if (!blocks.length) return []
  const lattice = new Lattice(blocks)
  const pieces = lattice.pieces()
  // a district is one piece of ground, so a town split in two cannot share one
  // across the gap: every piece gets at least one, then the rest are shared out
  // by how much town each piece holds
  const given = shares(pieces, districtsWanted(blocks.length))
  const seeds = pieces.flatMap((piece, at) => spread(blocks, piece, given[at]!, rng.fork(`seeds/${at}`)))
  const owner = grow(lattice, seeds, rng)

  const held: number[][] = seeds.map(() => [])
  owner.forEach((district, block) => held[district]!.push(block))
  return held.map((one) => ({ blocks: one, bearing: bearingOf(one.map((block) => blocks[block]!), lattice.extent) }))
}

/** The district a rectangle stands in: the one holding a block it falls inside. */
export function districtAt<T extends { readonly blocks: readonly Rect[] }>(districts: readonly T[], rect: Rect): T | undefined {
  return districts.find((district) => district.blocks.some((block) => inside(rect, block)))
}

/** North, south, west, east in the lattice: a district grows across a street, never across a corner. */
const FOUR_WAYS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
]

const inside = (rect: Rect, block: Rect): boolean =>
  rect.x >= block.x && rect.y >= block.y && rect.x + rect.w <= block.x + block.w && rect.y + rect.h <= block.y + block.h

/**
 * The blocks of a town as a lattice: every block by its column and its row
 * among the street lines, whatever size each one is. Two blocks are neighbours
 * when they are next to each other in it, so a block across a park or across
 * the edge of town is not one, and a district grown four ways is a district you
 * can walk across.
 */
class Lattice {
  readonly extent: { readonly width: number; readonly height: number }
  readonly #neighbours: readonly (readonly number[])[]

  constructor(blocks: readonly Rect[]) {
    const columns = axis(blocks.map((block) => block.x))
    const rows = axis(blocks.map((block) => block.y))
    const at = blocks.map((block) => ({ col: columns.get(block.x)!, row: rows.get(block.y)! }))
    const byCell = new Map(at.map((cell, index) => [`${cell.col},${cell.row}`, index]))
    this.#neighbours = at.map((cell) =>
      FOUR_WAYS.flatMap(([dx, dy]) => {
        const found = byCell.get(`${cell.col + dx},${cell.row + dy}`)
        return found === undefined ? [] : [found]
      }),
    )
    this.extent = blocks.reduce(
      (widest, block) => ({ width: Math.max(widest.width, block.x + block.w), height: Math.max(widest.height, block.y + block.h) }),
      { width: 0, height: 0 },
    )
  }

  neighbours(block: number): readonly number[] {
    return this.#neighbours[block]!
  }

  get size(): number {
    return this.#neighbours.length
  }

  /** The blocks you can walk between, as separate lists: usually one, more where a park cuts the town in two. */
  pieces(): number[][] {
    const seen = new Set<number>()
    const found: number[][] = []
    for (let block = 0; block < this.size; block++) {
      if (seen.has(block)) continue
      const piece: number[] = [block]
      seen.add(block)
      for (let at = 0; at < piece.length; at++) {
        for (const next of this.neighbours(piece[at]!)) {
          if (seen.has(next)) continue
          seen.add(next)
          piece.push(next)
        }
      }
      found.push(piece)
    }
    return found
  }
}

/** Every distinct coordinate along one axis, numbered in order: the street lines a block sits between. */
function axis(starts: readonly number[]): Map<number, number> {
  const sorted = [...new Set(starts)].sort((a, b) => a - b)
  return new Map(sorted.map((start, index) => [start, index]))
}

/**
 * How many districts each piece of town gets: one each, because a district is
 * one piece of ground, then the rest handed out one at a time to whichever
 * piece is carrying the most blocks per district it already has. A piece never
 * gets more districts than it has blocks.
 */
function shares(pieces: readonly (readonly number[])[], wanted: number): number[] {
  const given = pieces.map(() => 1)
  for (let left = wanted - pieces.length; left > 0; left--) {
    const next = pieces
      .map((piece, at) => ({ at, per: piece.length / given[at]!, room: given[at]! < piece.length }))
      .filter((one) => one.room)
      .sort((a, b) => b.per - a.per || a.at - b.at)[0]
    if (!next) break
    given[next.at]!++
  }
  return given
}

/**
 * Starting blocks spread over one piece of town: the first drawn from the seed,
 * each next one the block furthest from every one already taken, so two
 * districts never grow out of the same corner.
 */
function spread(blocks: readonly Rect[], piece: readonly number[], count: number, rng: Rng): number[] {
  const wanted = Math.max(1, Math.min(count, piece.length))
  const picked = [rng.pick([...piece])]
  while (picked.length < wanted) {
    let best = -1
    let apart = -1
    for (const block of piece) {
      if (picked.includes(block)) continue
      const near = Math.min(...picked.map((other) => between(blocks[block]!, blocks[other]!)))
      if (near > apart) {
        apart = near
        best = block
      }
    }
    picked.push(best)
  }
  return picked
}

const centre = (rect: Rect): { x: number; y: number } => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })

const between = (a: Rect, b: Rect): number => Math.hypot(centre(a).x - centre(b).x, centre(a).y - centre(b).y)

/**
 * Region growing, in turn: every district takes one block off its own edge per
 * round, drawn from its own stream, until no block is unclaimed. Taking one at
 * a time rather than one district at a time is what keeps the districts a town
 * of comparable pieces instead of one that ate everything.
 */
function grow(lattice: Lattice, seeds: readonly number[], rng: Rng): number[] {
  const owner = new Array<number>(lattice.size).fill(-1)
  const edges: number[][] = seeds.map(() => [])
  const streams = seeds.map((_, district) => rng.fork(`grow/${district}`))

  seeds.forEach((seed, district) => {
    owner[seed] = district
    edges[district]!.push(...lattice.neighbours(seed))
  })

  for (let claimed = true; claimed; ) {
    claimed = false
    for (const [district, edge] of edges.entries()) {
      const taken = take(edge, owner, streams[district]!)
      if (taken === undefined) continue
      owner[taken] = district
      for (const next of lattice.neighbours(taken)) if (owner[next] === -1) edge.push(next)
      claimed = true
    }
  }
  return owner
}

/** One unclaimed block off an edge, drawn from the seed; nothing when the edge has run out. */
function take(edge: number[], owner: readonly number[], rng: Rng): number | undefined {
  while (edge.length) {
    const at = rng.int(0, edge.length)
    const block = edge[at]!
    edge[at] = edge[edge.length - 1]!
    edge.pop()
    if (owner[block] === -1) return block
  }
  return undefined
}

/** How far off the middle a district's own middle has to sit before it is called a side of town rather than the middle of it. */
const OFF_CENTRE = 0.2

/** Which way a set of blocks lies from the middle of the town they are in. */
function bearingOf(blocks: readonly Rect[], extent: { readonly width: number; readonly height: number }): Bearing {
  const middle = blocks.reduce((sum, block) => ({ x: sum.x + centre(block).x / blocks.length, y: sum.y + centre(block).y / blocks.length }), { x: 0, y: 0 })
  const away = { x: (middle.x - extent.width / 2) / (extent.width / 2), y: (middle.y - extent.height / 2) / (extent.height / 2) }
  if (Math.hypot(away.x, away.y) < OFF_CENTRE) return 'middle'
  // the grid counts rows southwards, so a smaller row is further north
  const north = away.y < -OFF_CENTRE ? 'north' : away.y > OFF_CENTRE ? 'south' : ''
  const east = away.x > OFF_CENTRE ? 'east' : away.x < -OFF_CENTRE ? 'west' : ''
  return ((north && east ? `${north}-${east}` : north || east) || 'middle') as Bearing
}
