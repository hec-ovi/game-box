import type { FaceId } from '../compose/faces.ts'

/**
 * What a sign is, before anything is drawn: a rectangle somewhere on a wall,
 * the colour it burns, and the letters written across it.
 *
 * Everything is in the building's own frame, so a sign travels with its
 * building into `@gb/scene`'s shared buffers the same way a window pane does.
 */

/** One letter, in the panel's own metres: `u` across, `v` up, panel centre at zero. */
export interface Written {
  /** Which cell of the sign atlas: a letter, a digit, a mark, or the lit fill. */
  readonly cell: string
  readonly u: number
  readonly v: number
  readonly width: number
  readonly height: number
}

/** A lettered panel, a bare tube, or the lamp at the door. */
export type SignKind = 'sign' | 'strip' | 'doorlamp'

/** Flat on its wall, or hung off it at a right angle and lit on both sides. */
export type Mount = 'flat' | 'hung'

/** One lit rectangle on a building. */
export interface Sign {
  readonly kind: SignKind
  /** The wall it belongs to. */
  readonly wall: FaceId
  readonly mount: Mount
  /** Centre of the panel, in the building's own frame. */
  readonly origin: readonly [number, number, number]
  /** Unit vector along the panel's width, as `[x, z]`. The panel looks along `right` turned up. */
  readonly right: readonly [number, number]
  readonly width: number
  readonly height: number
  /** The tubes. */
  readonly ink: number
  /** The box they are mounted on. */
  readonly panel: number
  /** How hard the tubes burn after dark, and how hard the panel does behind them. */
  readonly glow: readonly [number, number]
  /** What is written on it. */
  readonly glyphs: readonly Written[]
}

export const SIGN = {
  /** The one material every sign in the city is drawn with. */
  material: 'kit:sign',
  /** How far a flat panel stands off the wall, clear of the kit's own trim. */
  stand: 0.08,
  /** How far a sign hangs out over the street. */
  reach: 1.15,
  /** How much wall a hung sign's bracket takes, along the wall. */
  foot: 0.16,
  /**
   * How much brighter than its own colour a tube burns after dark. Held low
   * enough that a saturated tube stays its own colour through the tone map:
   * the brightness past this belongs to the bloom pass, not to the surface.
   */
  glow: 2,
  /** How far each layer sits in front of the one behind, so coplanar quads do not fight. */
  layer: 0.005,
} as const

/** The outward normal of a wall whose panels run along `right`. */
export function outward(right: readonly [number, number]): readonly [number, number] {
  return [-right[1], right[0]]
}
