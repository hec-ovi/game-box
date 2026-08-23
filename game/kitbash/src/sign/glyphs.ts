/**
 * The alphabet the city's signs are written with, drawn from code as strokes on
 * a 4 by 6 grid: baseline at y = 0, cap height at y = 6, x from 0 to 4.
 *
 * Nothing here is downloaded. A world file has to carry its own signage, so the
 * letters are geometry we own; the atlas rasterises each stroke as a
 * round-capped tube, which is what a neon letter is made of.
 *
 * Alongside the letters are the marks: glyphs that spell nothing. Half the
 * signage on a real street is unreadable from the pavement and still does its
 * work, so a strip of marks is a sign without a word in it.
 */

/** A point on the drawing grid. */
export type Point = readonly [number, number]

/** A run of points, drawn as one connected tube. */
export type Stroke = readonly Point[]

export interface Glyph {
  readonly strokes: readonly Stroke[]
  /** Multiplies the tube thickness. Only the dot wants a fat one. */
  readonly weight?: number
  /** Fills the whole cell instead of drawing strokes: the lit panel itself. */
  readonly fill?: boolean
}

/** The box every glyph is drawn in. */
export const GRID = { width: 4, height: 6 } as const

const strokes = (...of: Stroke[]): Glyph => ({ strokes: of })

/** A closed ring, as a polyline of `sides` points. */
function ring(cx: number, cy: number, rx: number, ry: number, sides = 16): Stroke {
  const points: Point[] = []
  for (let at = 0; at <= sides; at++) {
    const angle = (at / sides) * Math.PI * 2
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry])
  }
  return points
}

const O_RING = ring(2, 3, 2, 3)

export const GLYPHS: Record<string, Glyph> = {
  ' ': strokes(),
  A: strokes([[0, 0], [2, 6], [4, 0]], [[0.7, 2.1], [3.3, 2.1]]),
  B: strokes([[0, 0], [0, 6], [2.6, 6], [3.8, 5.2], [3.8, 4], [2.6, 3.2], [0, 3.2]], [[2.6, 3.2], [4, 2.3], [4, 0.9], [2.6, 0], [0, 0]]),
  C: strokes([[4, 4.9], [2.8, 6], [1.2, 6], [0, 4.8], [0, 1.2], [1.2, 0], [2.8, 0], [4, 1.1]]),
  D: strokes([[0, 0], [0, 6], [2.4, 6], [4, 4.4], [4, 1.6], [2.4, 0], [0, 0]]),
  E: strokes([[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3.2, 3]]),
  F: strokes([[4, 6], [0, 6], [0, 0]], [[0, 3.2], [3.2, 3.2]]),
  G: strokes([[4, 4.9], [2.8, 6], [1.2, 6], [0, 4.8], [0, 1.2], [1.2, 0], [2.8, 0], [4, 1.1], [4, 2.6], [2.2, 2.6]]),
  H: strokes([[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]),
  I: strokes([[2, 0], [2, 6]], [[0.6, 6], [3.4, 6]], [[0.6, 0], [3.4, 0]]),
  J: strokes([[3.4, 6], [3.4, 1.4], [2.4, 0], [1, 0], [0, 1.2]]),
  K: strokes([[0, 0], [0, 6]], [[4, 6], [0.3, 2.5]], [[1.4, 3.5], [4, 0]]),
  L: strokes([[0, 6], [0, 0], [3.8, 0]]),
  M: strokes([[0, 0], [0, 6], [2, 2.4], [4, 6], [4, 0]]),
  N: strokes([[0, 0], [0, 6], [4, 0], [4, 6]]),
  O: strokes(O_RING),
  P: strokes([[0, 0], [0, 6], [2.8, 6], [4, 5], [4, 3.8], [2.8, 2.8], [0, 2.8]]),
  Q: strokes(O_RING, [[2.4, 1.4], [4.2, -0.4]]),
  R: strokes([[0, 0], [0, 6], [2.8, 6], [4, 5], [4, 3.8], [2.8, 2.8], [0, 2.8]], [[2.4, 2.8], [4, 0]]),
  S: strokes([[4, 5], [2.8, 6], [1.2, 6], [0, 5], [0, 4], [1.2, 3.2], [2.8, 3.2], [4, 2.4], [4, 1], [2.8, 0], [1.2, 0], [0, 1]]),
  T: strokes([[0, 6], [4, 6]], [[2, 6], [2, 0]]),
  U: strokes([[0, 6], [0, 1.2], [1.2, 0], [2.8, 0], [4, 1.2], [4, 6]]),
  V: strokes([[0, 6], [2, 0], [4, 6]]),
  W: strokes([[0, 6], [0.9, 0], [2, 3.4], [3.1, 0], [4, 6]]),
  X: strokes([[0, 6], [4, 0]], [[0, 0], [4, 6]]),
  Y: strokes([[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]),
  Z: strokes([[0, 6], [4, 6], [0, 0], [4, 0]]),

  0: strokes(O_RING, [[0.7, 1.1], [3.3, 4.9]]),
  1: strokes([[0.7, 4.6], [2, 6], [2, 0]], [[0.6, 0], [3.4, 0]]),
  2: strokes([[0, 5], [1.2, 6], [2.8, 6], [4, 5], [4, 3.8], [0, 0], [4, 0]]),
  3: strokes([[0, 5.2], [1.2, 6], [2.8, 6], [4, 5], [4, 4], [2.8, 3.2], [1.6, 3.2]], [[2.8, 3.2], [4, 2.4], [4, 1], [2.8, 0], [1.2, 0], [0, 0.8]]),
  4: strokes([[3, 0], [3, 6], [0, 2], [4, 2]]),
  5: strokes([[4, 6], [0.4, 6], [0, 3.4], [1, 3.9], [2.8, 3.9], [4, 2.9], [4, 1.1], [2.8, 0], [1.2, 0], [0, 0.8]]),
  6: strokes([[3.6, 5.6], [2.4, 6], [1.2, 6], [0, 4.8], [0, 1.2], [1.2, 0], [2.8, 0], [4, 1.1], [4, 2.2], [2.8, 3.2], [1.2, 3.2], [0, 2.2]]),
  7: strokes([[0, 6], [4, 6], [1.4, 0]]),
  8: strokes([[1.4, 3.2], [0, 4.2], [0, 5], [1.2, 6], [2.8, 6], [4, 5], [4, 4.2], [2.6, 3.2], [1.4, 3.2], [0, 2.2], [0, 1], [1.2, 0], [2.8, 0], [4, 1], [4, 2.2], [2.6, 3.2]]),
  9: strokes([[0.4, 0.4], [1.6, 0], [2.8, 0], [4, 1.2], [4, 4.8], [2.8, 6], [1.2, 6], [0, 4.9], [0, 3.8], [1.2, 2.8], [2.8, 2.8], [4, 3.8]]),

  '-': strokes([[0.5, 3], [3.5, 3]]),
  '&': strokes([[4, 0], [0.9, 3.2], [0.9, 5], [1.8, 6], [2.7, 5], [2.7, 4.1], [0, 1.5], [0, 0.8], [1, 0], [2.4, 0], [3.6, 1.2]]),
  "'": strokes([[2, 6], [2, 4.6]]),
  '!': strokes([[2, 6], [2, 1.7]], [[2, 0.4], [2, 0.4]]),
  '.': { strokes: [[[2, 0.4], [2, 0.4]]], weight: 1.6 },

  // the shapes that spell nothing: a sign at the far end of a street
  mark0: strokes([[0.4, 5.2], [3.6, 5.2], [3.6, 1], [0.4, 1], [0.4, 5.2]], [[0.4, 3.1], [3.6, 3.1]]),
  mark1: strokes([[2, 6], [2, 0]], [[0.2, 4.4], [3.8, 4.4]], [[0.6, 2.2], [3.4, 2.2]]),
  mark2: strokes([[0.3, 5.6], [3.7, 5.6]], [[2, 5.6], [2, 2.6]], [[0.3, 2.6], [3.7, 2.6]], [[0.8, 0.3], [3.2, 0.3]]),
  mark3: strokes([[0.4, 6], [0.4, 0]], [[0.4, 6], [3.6, 6]], [[3.6, 6], [3.6, 3.2]], [[1.6, 3.2], [3.6, 3.2]], [[2, 3.2], [2, 0]]),
  mark4: strokes([[0.4, 4.8], [3.6, 4.8]], [[1.2, 6], [1.2, 3.2]], [[2.8, 6], [2.8, 3.2]], [[0.4, 1.6], [3.6, 1.6]], [[2, 3.2], [2, 0]]),
  mark5: strokes([[2, 6], [0.3, 3.4]], [[2, 6], [3.7, 3.4]], [[0.6, 2], [3.4, 2]], [[2, 3.4], [2, 0]]),
  mark6: strokes([[0.4, 5.4], [3.6, 5.4], [3.6, 0.6], [0.4, 0.6], [0.4, 5.4]], [[1.5, 4.2], [2.5, 1.8]]),
  mark7: strokes([[0.3, 6], [3.7, 6]], [[2, 6], [2, 4]], [[0.5, 4], [3.5, 4]], [[0.5, 4], [0.9, 1]], [[3.5, 4], [3.1, 1]], [[0.6, 0.4], [3.4, 0.4]]),

  // furniture: a lit surface, a pointer, a ring
  solid: { strokes: [], fill: true },
  arrow: strokes([[0.2, 3], [3.8, 3]], [[2.4, 4.6], [3.8, 3], [2.4, 1.4]]),
  ring: strokes(ring(2, 3, 1.7, 2.5)),
}

/** Every cell the atlas holds, in the order it holds them. */
export const GLYPH_KEYS: readonly string[] = Object.keys(GLYPHS)

/** The marks, for a sign that says nothing: the shapes plus a pointer and a roundel. */
export const MARKS: readonly string[] = [...GLYPH_KEYS.filter((key) => key.startsWith('mark')), 'arrow', 'ring']

/** The empty cell: what a panel with no letter on it is drawn with. */
export const BLANK = ' '

/** The full cell: a bar of light, a tube, the edge of a box. */
export const SOLID = 'solid'

/** The cell for one character of a name, or a blank where we have no letter. */
export function cellFor(character: string): string {
  const upper = character.toUpperCase()
  return Object.hasOwn(GLYPHS, upper) ? upper : BLANK
}
