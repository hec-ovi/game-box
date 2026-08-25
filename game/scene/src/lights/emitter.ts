/**
 * One lit thing on a building, published by its dressing for whoever draws
 * the lights: where it burns, in what colour, how hard and how far. The
 * building's own frame, metres, origin at the centre of its base.
 */
export interface LightEmitter {
  /** What is burning: a dressing's own word for it (`sign`, `doorlamp`, `screen`, `entrance`). */
  readonly kind: string
  /** Just off the lit face, in the building's frame: x, y, z. */
  readonly position: readonly [number, number, number]
  /** What burns, packed `0xRRGGBB`. */
  readonly colour: number
  /** Candela at full dark. */
  readonly intensity: number
  /** Metres past which it is not worth drawing. */
  readonly radius: number
}
