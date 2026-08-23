import { storeyHeight } from '@gb/scene'
import type { Plot } from '@gb/world'

/**
 * The shape a plot asks a building to be: how wide its street face is, how far
 * back it runs, and how many storeys it stacks. Everything in metres, because a
 * model is baked at a size and never scaled to fit.
 */
export interface Bucket {
  /** Across the face the door is on. */
  readonly front: number
  /** Back from that face. */
  readonly depth: number
  readonly storeys: number
}

/** Street faces the forge cuts, in metres: 3 to 6 cells of 2 m. */
export const FRONTS: readonly number[] = [6, 8, 10, 12]
/** Depths the forge cuts, in metres: 5 to 8 cells of 2 m. */
export const DEPTHS: readonly number[] = [10, 12, 14, 16]
/** Storey counts a catalogue covers. Taller plots fall through to the kit. */
export const STOREYS: readonly number[] = [1, 2, 3, 4]

/** Every shape a catalogue is expected to hold, in a fixed order. */
export function everyBucket(): Bucket[] {
  return STOREYS.flatMap((storeys) => FRONTS.flatMap((front) => DEPTHS.map((depth) => ({ front, depth, storeys }))))
}

/**
 * The shape this plot needs. A plot whose door is on an east or west wall is
 * the same shape turned a quarter, so the bucket is read in the door's frame
 * and one model serves all four compass points.
 */
export function bucketOf(plot: Plot, size: { width: number; depth: number }): Bucket {
  const acrossZ = plot.entrance.facing === 'north' || plot.entrance.facing === 'south'
  return {
    front: acrossZ ? size.width : size.depth,
    depth: acrossZ ? size.depth : size.width,
    storeys: plot.storeys,
  }
}

/** One string per shape, so a bucket can be a map key. */
export function bucketKey(bucket: Bucket): string {
  return `${bucket.front}x${bucket.depth}x${bucket.storeys}`
}

/** How tall a building of this many storeys stands. The city's own number. */
export function heightOf(storeys: number): number {
  return storeyHeight(storeys)
}
