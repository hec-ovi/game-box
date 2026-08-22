import type { PropArt } from '../catalog/props.ts'

export interface Size {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * What to multiply a source model by so it ends up in the box the room planner
 * kept clear for it.
 *
 * The footprint is a hard edge: `w` and `d` are the floor nothing else may
 * stand on, so both horizontal axes are scaled to fill it exactly. Height is
 * either given, because a counter has to be counter height, or taken as the
 * average of the two horizontal scales, which leaves the model's own
 * proportions alone.
 *
 * The kits are chunkier than a real room, so filling a shallow footprint means
 * squeezing a piece in depth. That is the axis a player never sees: furniture
 * stands against a wall and is read from the front.
 */
export function fitScale(source: Size, art: PropArt): Size {
  const x = art.w / extent(source.x)
  const z = art.d / extent(source.z)
  return { x, y: art.h === undefined ? (x + z) / 2 : art.h / extent(source.y), z }
}

/** How much the front face of a piece is stretched: what the distortion actually looks like. */
export function faceStretch(scale: Size): number {
  return Math.max(scale.x, scale.y) / Math.min(scale.x, scale.y)
}

/** A model with no thickness on some axis would scale to infinity; nothing in the kits does. */
function extent(value: number): number {
  return value > 1e-6 ? value : 1
}
