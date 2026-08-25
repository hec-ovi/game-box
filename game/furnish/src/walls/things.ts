/**
 * The small things standing in a niche or on a shelf.
 *
 * These are decoration, not furniture: a cup, a bottle, a canister, a box, a
 * tray, a stack of books. They are drawn into the same buffer as the wall they
 * stand on, out of the same primitive as everything else in this box, and they
 * are nothing to the rest of the game: nobody can pick one up and nothing
 * collides with one. A `@gb/world` `FurnitureProp` is a different thing
 * entirely and lives in the catalog.
 *
 * Every one is a whole number of 10 cm cells across and exactly one deep, so
 * they land on the same lattice as the bay they stand in and fit the shallow
 * shelf a wall can afford.
 */
import type { Rng } from '@gb/kit'
import { PROP_CELL } from '@gb/world'
import type { Solid } from '../build/solid.ts'
import type { Look } from '../build/look.ts'
import { cornersOf, edgeOf, type Variant } from '../style/variant.ts'

export type ThingKind = 'cup' | 'bottle' | 'canister' | 'box' | 'stack' | 'tray' | 'crate'

export interface ThingSpec {
  /** Cells across. Everything is one cell deep. */
  readonly cells: number
  readonly height: number
}

export const THING_SPECS: Record<ThingKind, ThingSpec> = {
  cup: { cells: 1, height: 0.09 },
  bottle: { cells: 1, height: 0.26 },
  canister: { cells: 1, height: 0.19 },
  box: { cells: 2, height: 0.13 },
  stack: { cells: 2, height: 0.11 },
  tray: { cells: 3, height: 0.03 },
  crate: { cells: 3, height: 0.16 },
}

const TASTE: readonly (readonly [ThingKind, number])[] = [
  ['cup', 4],
  ['bottle', 3],
  ['canister', 3],
  ['box', 4],
  ['stack', 3],
  ['tray', 2],
  ['crate', 2],
]

/** Air left round a thing inside its cells, so two side by side do not touch. */
const AIR = 0.02

/** Points per rounded corner: these are 8 cm across and stand behind a shelf cheek. */
const ARC = 2

export interface Ledge {
  /** Metres off the floor of the surface they stand on. */
  readonly y: number
  /** Half the width of the bay, so a row can be centred in it. */
  readonly half: number
  /** Metres of clear air over the ledge. */
  readonly headroom: number
  /** How far the ledge reaches out of the wall. */
  readonly depth: number
  /** Cells the row may not use at each end. */
  readonly margin: number
}

/**
 * A row of things on one ledge, left to right on the cell lattice, drawn into
 * the bay's own frame: x across the bay, y off the floor, z out of the wall.
 */
export function standThings(solid: Solid, variant: Variant, ledge: Ledge, rng: Rng): void {
  const cells = Math.floor((2 * ledge.half) / PROP_CELL + 1e-6) - 2 * ledge.margin
  if (cells < 1) return

  const chosen: ThingKind[] = []
  let used = 0
  for (let at = 0; at < 4; at++) {
    const kind = rng.fork(`pick${at}`).weighted(TASTE as [ThingKind, number][])
    const spec = THING_SPECS[kind]
    if (spec.height > ledge.headroom) continue
    const next = used + spec.cells + (chosen.length ? 1 : 0)
    if (next > cells) break
    chosen.push(kind)
    used = next
    if (rng.fork(`stop${at}`).chance(0.3)) break
  }
  if (!chosen.length) return

  let at = -ledge.half + ledge.margin * PROP_CELL + ((cells - used) * PROP_CELL) / 2
  for (const [index, kind] of chosen.entries()) {
    const spec = THING_SPECS[kind]
    const width = spec.cells * PROP_CELL
    draw(solid, variant, kind, at + width / 2, ledge, rng.fork(`thing${index}`))
    at += width + PROP_CELL
  }
}

function draw(solid: Solid, variant: Variant, kind: ThingKind, x: number, ledge: Ledge, rng: Rng): void {
  const spec = THING_SPECS[kind]
  const width = spec.cells * PROP_CELL - AIR
  const depth = Math.min(PROP_CELL - AIR, ledge.depth - AIR)
  const z = depth / 2 + AIR / 2
  const y0 = ledge.y
  const y1 = y0 + spec.height
  const { palette } = variant
  // pale by preference: a niche is lit by a strip, not by a lamp, so a dark
  // object standing in one is a dark object standing in a dark box
  const body = rng.weighted([
    [palette.top, 4],
    [palette.board, 3],
    [palette.accent, 3],
    [palette.shell, 1],
  ] as [Look, number][])
  const round = { x, z, width, depth, corner: Math.min(width, depth) / 2, arc: ARC }
  const box = { x, z, width, depth, arc: ARC, corner: cornersOf(variant, 0.012), top: edgeOf(variant, 0.008) }

  switch (kind) {
    case 'cup':
      solid.block({ ...round, y0, y1, look: body, bottomInset: 0.012 })
      return
    case 'bottle':
      solid.block({ ...round, y0, y1: y0 + spec.height * 0.6, look: body, bottomInset: 0.008 })
      solid.block({
        ...round,
        width: width * 0.45,
        depth: depth * 0.45,
        corner: (width * 0.45) / 2,
        y0: y0 + spec.height * 0.6,
        y1,
        look: palette.top,
      })
      return
    case 'canister':
      solid.block({ ...round, y0, y1: y1 - 0.03, look: body })
      solid.block({ ...round, y0: y1 - 0.03, y1, look: palette.glow })
      return
    case 'stack':
      for (let sheet = 0; sheet < 3; sheet++) {
        const step = spec.height / 3
        solid.block({
          ...box,
          width: width - sheet * 0.008,
          y0: y0 + sheet * step,
          y1: y0 + (sheet + 1) * step - 0.002,
          look: sheet === 1 ? palette.accent : body,
        })
      }
      return
    case 'tray':
      solid.block({ ...box, y0, y1, look: palette.frame })
      return
    case 'crate':
      solid.block({ ...box, y0, y1: y1 - 0.025, look: body })
      solid.block({ ...box, width: width - 0.01, y0: y1 - 0.025, y1, look: palette.frame })
      return
    case 'box':
      solid.block({ ...box, y0, y1, look: body })
      return
  }
}
