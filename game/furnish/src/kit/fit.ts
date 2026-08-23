import type { PropArt } from '../catalog/props.ts'

export interface Size {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * What to multiply a source model by so it ends up in the box the room planner
 * kept clear for it, with the surface a body meets where the body expects it.
 *
 * The footprint is a hard edge: `w` and `d` are the floor nothing else may
 * stand on, so both horizontal axes are scaled to fill it exactly.
 *
 * The vertical is whichever of three the piece asks for. A piece somebody uses
 * is scaled by its contact surface, so the seat lands at seat height and the
 * counter at counter height however tall the rest of the model happens to be. A
 * piece nobody touches takes the height it names, or keeps its own proportions.
 *
 * `contactAt` is where that surface sits in the source, off the model's base,
 * as `contact.ts` measured it.
 */
export function fitScale(source: Size, art: PropArt, contactAt?: number): Size {
  const x = art.w / extent(source.x)
  const z = art.d / extent(source.z)
  return { x, y: heightScale(source, art, contactAt) ?? (x + z) / 2, z }
}

function heightScale(source: Size, art: PropArt, contactAt: number | undefined): number | undefined {
  if (art.contact && contactAt !== undefined) return art.contact.height / extent(contactAt)
  if (art.h !== undefined) return art.h / extent(source.y)
  return undefined
}

/** How much the front face of a piece is stretched: what the distortion actually looks like. */
export function faceStretch(scale: Size): number {
  return Math.max(scale.x, scale.y) / Math.min(scale.x, scale.y)
}

/** A model with no thickness on some axis would scale to infinity; nothing in the kits does. */
function extent(value: number): number {
  return value > 1e-6 ? value : 1
}
