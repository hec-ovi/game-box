/**
 * What a wall is made of.
 *
 * A wall is not one surface. It is a run of bays: a whole number of 10 cm room
 * cells each, side by side along the wall, each one plain, panelled, a lit
 * recess with something standing in it, a shelf, a framed picture, a grille, a
 * light strip or a window.
 *
 * This file is the vocabulary and nothing else: how wide a bay of each kind may
 * be, how far it stands off the wall, and the lowest part of it that sticks
 * out. How often a wall reaches for each is `taste.ts`, where a bay goes is
 * `plan.ts` and what it looks like is `draw.ts`, so the distribution can be
 * retuned without touching the geometry and the other way round.
 */
import { METRICS } from '@gb/world'

export type BayKind = 'plain' | 'panel' | 'niche' | 'shelf' | 'frame' | 'grille' | 'strip' | 'window'

export interface BaySpec {
  /** How wide it may be, in 10 cm room cells: fewest, then most. */
  readonly cells: readonly [number, number]
  /** Metres it stands off the face of the wall at its deepest. */
  readonly depth: number
  /** Metres off the floor of the lowest part of it that stands off the wall. */
  readonly low: number
  /** Only on a wall with the street on the other side of it. */
  readonly outsideOnly?: boolean
  /**
   * True for a bay thin enough to vanish behind whatever stands against the
   * wall, so furniture in front of it is not a reason to leave it out.
   */
  readonly behindFurniture?: boolean
}

const { serviceCounterHeight, worktopHeight } = METRICS.furniture

/**
 * The heights a wall is divided at.
 *
 * The two a body can put something down on come from `METRICS.furniture`, the
 * same place every other contact height in this box comes from: a niche sill is
 * at hand height and the lowest shelf ledge is a worktop. The rest are the
 * wall's own proportions and live here.
 */
export const WALL = {
  /** The field of bays runs from the floor to here. */
  head: 2.4,
  /** The rail over the field, and the lit channel under it. */
  rail: { under: 2.375, top: 2.52, depth: 0.07 },
  /** A lit recess: the sill you stand something on, and the head over it. */
  niche: { sill: serviceCounterHeight, head: 1.8, depth: 0.1, jamb: 0.08, reveal: 0.08 },
  /** Ledges, lowest first, every `pitch` metres up. */
  shelf: { lowest: worktopHeight, pitch: 0.42, depth: 0.14, ledge: 0.04, cheek: 0.04 },
  frame: { low: 1.05, high: 1.95, depth: 0.03, border: 0.04 },
  grille: { low: 1.1, high: 1.85, depth: 0.035, slats: 6 },
  strip: { low: 0.1, high: 2.3, depth: 0.035, width: 0.1 },
  window: { low: 1, high: 2.2, depth: 0.06, frame: 0.07 },
  panel: { low: 0.04, depth: 0.03, gap: 0.02 },
} as const

/** The most cells a shelf bay ever carries. */
export const SHELF_LEDGES = 3

/**
 * Every height a wall offers to stand something on, lowest first, each one
 * once. A shelf's lowest ledge and a niche's sill are two different metres and
 * land on the same number whenever the worktop and the service counter agree.
 */
export const WALL_CONTACTS: readonly number[] = [
  ...new Set([
    ...Array.from({ length: SHELF_LEDGES }, (_, at) => WALL.shelf.lowest + at * WALL.shelf.pitch),
    WALL.niche.sill,
  ]),
].sort((one, two) => one - two)

export const BAY_SPECS: Record<BayKind, BaySpec> = {
  plain: { cells: [1, 40], depth: 0, low: WALL.head, behindFurniture: true },
  panel: { cells: [4, 12], depth: WALL.panel.depth, low: WALL.panel.low, behindFurniture: true },
  niche: { cells: [6, 12], depth: WALL.niche.depth, low: WALL.niche.sill - WALL.niche.reveal },
  shelf: { cells: [7, 14], depth: WALL.shelf.depth, low: WALL.shelf.lowest - WALL.shelf.ledge },
  frame: { cells: [5, 10], depth: WALL.frame.depth, low: WALL.frame.low },
  grille: { cells: [4, 9], depth: WALL.grille.depth, low: WALL.grille.low },
  strip: { cells: [4, 12], depth: WALL.strip.depth, low: WALL.strip.low },
  window: { cells: [8, 16], depth: WALL.window.depth, low: WALL.window.low, outsideOnly: true },
}

/** A bay with something standing off the wall in it, so two in a row read as one. */
export function isFeature(kind: BayKind): boolean {
  return kind !== 'plain' && kind !== 'panel'
}
