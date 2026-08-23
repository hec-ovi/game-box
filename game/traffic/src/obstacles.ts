import type { Point } from './geometry.ts'

/**
 * Something in the road that is not a car: a pedestrian, mostly. Whoever owns
 * the people implements this; traffic only ever reads it.
 */
export interface Obstacle extends Point {
  /** How much road it takes up, metres. Left out, half a metre: a person. */
  readonly radius?: number
}

/**
 * Where the people are. Traffic asks once per update for everyone near the
 * focus and works out for itself who is standing in which lane, so the answer
 * needs no knowledge of roads.
 */
export interface Obstacles {
  near(centre: Point, radius: number): readonly Obstacle[]
}
