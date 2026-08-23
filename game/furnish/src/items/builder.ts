import type { Solid } from '../build/solid.ts'
import type { ItemCast } from './cast.ts'

/**
 * What an item builder is handed: the thing under construction, the box its
 * archetype publishes, and the cast that decides its matter and its moulding.
 *
 * A builder draws to the numbers it is given and stays inside them. It never
 * scales anything, for the same reason a prop builder does not: the size is the
 * real object's size, and an envelope that came out at a crate's scale is the
 * fault this box exists to remove.
 */
export interface ItemBuild {
  readonly solid: Solid
  readonly cast: ItemCast
  /** Metres across the front. */
  readonly width: number
  /** Metres front to back. */
  readonly depth: number
  /** Metres tall. */
  readonly height: number
}

export type ItemBuilder = (build: ItemBuild) => void

/**
 * How far a label, a stamp or a stencil stands off the face it sits on.
 *
 * The face itself is set back by the same amount, so the patch fills the gap
 * and reaches the published box exactly. It is drawn a fraction below the face
 * as well, so no two coplanar faces are ever left to fight over a pixel.
 */
export const PROUD = 0.002
/** The same, on something made of paper, where two millimetres would be a plank. */
export const PRINT = 0.0005
/** How far under the face a patch starts. Enough for float32, invisible at any distance. */
export const BURY = 0.0004

/**
 * A body whose front face is set back so a label on it reaches the published
 * box. Shifted by the same amount, so a thing marked on one side only still
 * stands on its own middle.
 */
export function setBack(depth: number): { z: number; depth: number } {
  return { z: PROUD / 2, depth: depth - PROUD }
}

/** The patch on that face: it fills the set-back and bites into the body behind it. */
export function facing(depth: number): { z: number; depth: number } {
  return { z: -(depth - PROUD - BURY) / 2, depth: PROUD + BURY }
}
