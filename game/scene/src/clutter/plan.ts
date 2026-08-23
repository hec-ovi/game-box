import { Rng } from '@gb/kit'
import { cellCentre, type CellKind, type World } from '@gb/world'
import type * as THREE from 'three'
import { groundTop, PAVED_KINDS } from '../ground.ts'
import type { Marking } from '../markings.ts'
import { SURFACE } from '../street/sizes.ts'
import { BAND, BAND_PICKS, CLEARANCE, CLUTTER, VARIANTS, type ClutterKind } from './catalog.ts'
import { Claims } from './claims.ts'
import { KeepOut } from './keepout.ts'

/** One thing lying on the street, in metres, its origin at the centre of its base. */
export interface ClutterPiece {
  readonly kind: ClutterKind
  /** Which of that kind's colourways it is drawn in. */
  readonly variant: number
  readonly x: number
  readonly y: number
  readonly z: number
  /** Three.js yaw. Unturned, a piece faces -Z. */
  readonly rot: number
  /** Half extents along the piece's own axes, and how tall it stands. */
  readonly halfWidth: number
  readonly halfDepth: number
  readonly height: number
}

/** How much rubbish a street carries. Retune these without touching what the rubbish is. */
export interface ClutterDensity {
  /** Chance a pavement cell with a building behind it gets something standing against the wall. */
  readonly wall: number
  /** Chance a pavement cell gets something dumped in the gutter. */
  readonly kerb: number
  /** Chance a paved cell gets a scrap of litter blown onto it. */
  readonly litter: number
}

export const CLUTTER_DENSITY: ClutterDensity = { wall: 0.34, kerb: 0.16, litter: 0.5 }

/** Everything stands on the wet film rather than under it, which is 2 cm of ground clearance. */
const LIFT = SURFACE.lift + 0.004

interface Step {
  readonly x: number
  readonly z: number
}

const SIDES: readonly Step[] = [
  { x: 0, z: -1 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 1, z: 0 },
]

/**
 * Where the rubbish goes, decided from the grid, the doorsteps and the paint
 * and nothing else.
 *
 * A pavement cell is read as three bands across: the building line, the walking
 * lane, and the gutter. A cell takes at most one of the outer two, whichever it
 * is the cell for, and never the middle, which is what keeps the middle of
 * every pavement walkable by construction rather than by hoping. The roadway takes
 * nothing that stands, because cars drive on it; it takes litter, and not on a
 * crossing, a stop bar or the double yellow down the middle.
 *
 * This is separate from what the rubbish looks like on purpose: the density can
 * be retuned, or the whole distribution replaced, without touching a model.
 */
export function planClutter(
  world: World,
  doorsteps: Iterable<THREE.Vector3>,
  markings: readonly Marking[],
  seed: string,
  density: ClutterDensity = CLUTTER_DENSITY,
): ClutterPiece[] {
  return new ClutterPlan(world, doorsteps, markings, seed, density).pieces()
}

class ClutterPlan {
  #world: World
  #cell: number
  #keepOut: KeepOut
  #claims: Claims
  #density: ClutterDensity
  #rng: Rng
  #out: ClutterPiece[] = []

  constructor(world: World, doorsteps: Iterable<THREE.Vector3>, markings: readonly Marking[], seed: string, density: ClutterDensity) {
    this.#world = world
    this.#cell = world.cellSize
    this.#keepOut = new KeepOut(doorsteps, markings)
    this.#claims = new Claims(world.grid.width * this.#cell, world.grid.height * this.#cell)
    this.#density = density
    this.#rng = new Rng(seed).fork('clutter')
  }

  pieces(): ClutterPiece[] {
    // standing first: it has the strongest claim on the pavement, and litter
    // fills in round it rather than the other way about
    this.#walk('standing', (x, y, kind, rng) => {
      if (kind === 'sidewalk') this.#standing(x, y, rng)
    })
    this.#walk('litter', (x, y, kind, rng) => {
      if (PAVED_KINDS.includes(kind)) this.#litter(x, y, kind, rng)
    })
    return this.#out
  }

  /** Every cell in the order the grid lists them, each with a stream of its own. */
  #walk(feature: string, visit: (x: number, y: number, kind: CellKind, rng: Rng) => void): void {
    const rng = this.#rng.fork(feature)
    for (let y = 0; y < this.#world.grid.height; y++) {
      for (let x = 0; x < this.#world.grid.width; x++) {
        const kind = this.#world.grid.at(x, y)
        if (kind !== undefined) visit(x, y, kind, rng)
      }
    }
  }

  /**
   * Bins, sacks, crates and pallets: against the building line, or in the
   * gutter. The two bands are asked of the cell each one belongs in, never both
   * of one cell. A pavement is two cells wide, so the gutter is the cell with
   * the road beside it and the building line is the cell with the wall behind
   * it, and neither of them is the other. On a one cell pavement they are the
   * same cell and it takes both, which is what a narrow alley wants.
   */
  #standing(cellX: number, cellY: number, rng: Rng): void {
    const toWall = this.#only(cellX, cellY, 'building')
    const toStreet = this.#only(cellX, cellY, 'street')

    if (toWall && rng.chance(this.#density.wall)) {
      this.#place(cellX, cellY, rng, 'wall', toWall, { x: -toWall.x, z: -toWall.z }, BAND.wall)
    }
    // a corner has roadway on two sides: leave it, the crowd turns there
    if (toStreet && rng.chance(this.#density.kerb)) {
      this.#place(cellX, cellY, rng, 'kerb', toStreet, toStreet, BAND.kerb)
    }
  }

  /** The one side of this cell that kind of ground is on, or nothing when it is on none or several. */
  #only(cellX: number, cellY: number, kind: CellKind): Step | undefined {
    const found = SIDES.filter((side) => this.#world.grid.at(cellX + side.x, cellY + side.z) === kind)
    return found.length === 1 ? found[0] : undefined
  }

  /**
   * One piece pushed to the far side of its band, turned to face the road, and
   * jittered along the pavement so a run of them is not a row.
   */
  #place(cellX: number, cellY: number, rng: Rng, band: 'wall' | 'kerb', towards: Step, facing: Step, room: number): void {
    const kind = rng.pick(BAND_PICKS[band])
    const spec = CLUTTER[kind]
    if (spec.depth > room) return

    const centre = cellCentre(cellX, cellY, this.#cell)
    const across = this.#cell / 2 - spec.depth / 2 - CLEARANCE.edge
    const slack = Math.max(0, this.#cell / 2 - spec.width / 2 - CLEARANCE.edge)
    const along = { x: towards.z, z: -towards.x }
    const shift = rng.range(-slack, slack)
    const x = centre.x + towards.x * across + along.x * shift
    const z = centre.z + towards.z * across + along.z * shift
    const rot = Math.atan2(-facing.x, -facing.z) + rng.range(-0.12, 0.12)

    const half = extents(spec.width, spec.depth, rot)
    if (this.#keepOut.blocked(x, z, half.x, half.z)) return
    if (!this.#claims.claim(x, z, half.x, half.z)) return

    const y = groundTop(this.#world.grid.at(cellX, cellY)) + LIFT
    this.#add(kind, rng, x, y, z, rot)
    if (kind === 'crate') this.#stack(rng, x, y, z, rot)
  }

  /**
   * A crate is rarely on its own: one or two more go on top, dropped
   * square-ish. Dropped square-ish is a wider rectangle than the one below it,
   * so each one is measured against what has to stay clear the same as the one
   * on the ground was, and the stack stops where the ground does.
   */
  #stack(rng: Rng, x: number, y: number, z: number, rot: number): void {
    const spec = CLUTTER.crate
    let top = y + spec.height
    for (let level = 0; level < 2 && rng.chance(0.45 - level * 0.2); level++) {
      const at = { x: x + rng.range(-0.05, 0.05), z: z + rng.range(-0.05, 0.05) }
      const turn = rot + rng.range(-0.35, 0.35)
      const half = extents(spec.width, spec.depth, turn)
      if (this.#keepOut.blocked(at.x, at.z, half.x, half.z)) return
      this.#add('crate', rng, at.x, top, at.z, turn)
      top += spec.height
    }
  }

  /** Scraps and cans, small enough to walk over, anywhere the paint is not. */
  #litter(cellX: number, cellY: number, kind: CellKind, rng: Rng): void {
    if (!rng.chance(this.#density.litter)) return
    const centre = cellCentre(cellX, cellY, this.#cell)
    const reach = this.#cell / 2 - 0.15
    const piece = rng.pick(BAND_PICKS.litter)
    const spec = CLUTTER[piece]
    const rot = rng.float() * Math.PI * 2
    const x = centre.x + rng.range(-reach, reach)
    const z = centre.z + rng.range(-reach, reach)

    const half = extents(spec.width, spec.depth, rot)
    if (this.#keepOut.blocked(x, z, half.x, half.z)) return
    if (!this.#claims.claim(x, z, half.x, half.z)) return
    this.#add(piece, rng, x, groundTop(kind) + LIFT, z, rot)
  }

  #add(kind: ClutterKind, rng: Rng, x: number, y: number, z: number, rot: number): void {
    const spec = CLUTTER[kind]
    this.#out.push({
      kind,
      variant: rng.pick(VARIANTS[kind]),
      x,
      y,
      z,
      rot,
      halfWidth: spec.width / 2,
      halfDepth: spec.depth / 2,
      height: spec.height,
    })
  }
}

/** The box a turned rectangle stands in, so a claim covers what is really there. */
function extents(width: number, depth: number, rot: number): { x: number; z: number } {
  const c = Math.abs(Math.cos(rot))
  const s = Math.abs(Math.sin(rot))
  return { x: (width / 2) * c + (depth / 2) * s, z: (width / 2) * s + (depth / 2) * c }
}
