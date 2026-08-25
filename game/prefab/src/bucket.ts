import { storeyHeight } from '@gb/scene'
import { METRICS, PLOT_BAND, plotShape, type Plot } from '@gb/world'

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

/**
 * Every shape a catalogue is expected to hold, in a fixed order: `@gb/world`'s
 * `PLOT_BAND`, which is how a city is cut, at the world's cell size.
 */
export function everyBucket(): Bucket[] {
  const cell = METRICS.cellSize
  return span(PLOT_BAND.storeys).flatMap((storeys) =>
    span(PLOT_BAND.frontage).flatMap((frontage) => span(PLOT_BAND.depth).map((depth) => ({ front: frontage * cell, depth: depth * cell, storeys }))),
  )
}

/**
 * The shape this plot needs. `plotShape` reads the plot in its door's frame, so
 * a door on an east or west wall is the same shape turned a quarter and one
 * model serves all four compass points. The metres come from the size the plot
 * is actually drawn at, so a world cut on another cell size falls through to
 * the dressing behind rather than wearing a model of the wrong size.
 */
export function bucketOf(plot: Plot, size: { width: number; depth: number }): Bucket {
  const shape = plotShape(plot)
  const cell = size.width / plot.rect.w
  return { front: shape.frontage * cell, depth: shape.depth * cell, storeys: shape.storeys }
}

/** One string per shape, so a bucket can be a map key. */
export function bucketKey(bucket: Bucket): string {
  return `${bucket.front}x${bucket.depth}x${bucket.storeys}`
}

/** How tall a building of this many storeys stands. The city's own number. */
export function heightOf(storeys: number): number {
  return storeyHeight(storeys)
}

function span(range: { readonly min: number; readonly max: number }): number[] {
  return Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i)
}
