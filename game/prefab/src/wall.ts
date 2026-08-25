/**
 * The two layers one wall picture lands on.
 *
 * A look names a picture in `finishes/`, and the pack stacks it twice: once as
 * the wall above the street, which the shader cuts window bays out of, and once
 * as the base, the same picture on the walls a composed band stands on (the
 * street level round the door, the parapet storey a board hangs on, the roof),
 * where a window drawn in the middle of every bay is exactly where the door and
 * the board land. Same pixels, one name apart, so a wall reads as its look all
 * the way down.
 */

/** A layer named `wall:<picture>`: the wall above the street, windows cut into it. */
export const WALL = 'wall:'

/** A layer named `base:<picture>`: the same picture with no windows in it. */
export const BASE = 'base:'

export function wallFinish(picture: string): string {
  return WALL + picture
}

export function baseFinish(picture: string): string {
  return BASE + picture
}

/**
 * Metres one repeat of the base covers, so it sits at the scale of the wall
 * above it. The producer lays a wall picture over four bays of 3 m and two
 * floors of 3.21 m (a floor and the centimetre bands overlap by), and tiles a
 * base square by the metre; it is told `across`, and the shader stretches v by
 * `across / down` to land on the wall's own scale.
 */
export const BASE_TILE = { across: 12, down: 6.42 } as const

/** How far the shader stretches a layer's v to read it at the wall's scale. 1 for everything but a base. */
export function stretchOf(finish: string): number {
  return finish.startsWith(BASE) ? BASE_TILE.across / BASE_TILE.down : 1
}
