/**
 * The two layers one wall picture lands on, and the size it is read at.
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
 * Metres of wall the producer lays one base repeat over. It is what fixes the
 * uv on a base plate, which is the frame the bay grid and the room are read in,
 * so the producer and this have to agree on it.
 */
export const BASE_TILE = 12

/**
 * Metres of real wall one repeat of a committed picture covers.
 *
 * It is the size the picture was generated at: `docs/textures/PROMPTS.md` asks
 * for a frame two metres square, and a slope, a course and a joint are only
 * right at the size they were drawn. The producer lays a wall picture over four
 * bays of 3 m and two floors of 3.21 m, and it tiles a base by `BASE_TILE`, so
 * the uv a wall carries is nothing like this number: read at it, brick came out
 * a metre a course.
 *
 * So a wall picture is read at the metres the surface itself measures rather
 * than at the uv the producer laid, which the surface's own derivatives give
 * for nothing. The uv is left where it is, because the bay grid, the room
 * raymarch and the glass are all cut from it.
 */
export const FACADE_TILE = 2

/**
 * Whether a finish is a tiling wall surface, read at `FACADE_TILE`. Everything
 * else is a picture laid to fit its own plate (a door, a screen, a shopfront
 * surround, a balustrade, a tube) and is read at the uv it was laid with.
 */
export function tiledByMetre(finish: string): boolean {
  return finish.startsWith(WALL) || finish.startsWith(BASE)
}
