/**
 * The strip behind the glass: every picture a window in the city can show,
 * stacked into one array texture beside the pack's others.
 *
 * Three kinds of layer share it, because they are all read by one sampler in
 * one branch of the wall shader. Back walls, one per kind of room, are the only
 * place detail belongs. Four shared faces, the floor, the ceiling and two side
 * walls, are what a marched room box reads on its other four sides. Flat
 * panels, a drawn curtain or a lowered shutter, are surfaces rather than
 * spaces, and they carry most of the windows in a street.
 *
 * Nothing here names a picture. The theme pack does that, and the build writes
 * the runs it landed on into the pack manifest, so the runtime reads its layout
 * off the art it was handed.
 */

/** Pixels a side, per layer. A shop window is two metres of it at arm's length, so this is the floor. */
export const ROOM_SIZE = 256

/** A run of the strip: the first layer and how many. Two runs may overlap, which is how one picture serves both banks. */
export interface Bank {
  readonly first: number
  readonly count: number
}

/** The two kinds of window, and the two runs anything picked per window is picked from. */
export interface Banks {
  /** Above the street: what people live and work in. */
  readonly upper: Bank
  /** On the pavement: what they walk into. */
  readonly street: Bank
}

/** Where the four faces every marched room shares sit in the strip. */
export interface Faces {
  readonly floor: number
  readonly ceiling: number
  /** Two side walls, so the opposite walls of one room are not the same picture. */
  readonly side: number
  readonly sideAlt: number
}

/** How the strip is laid out, as the pack manifest records it. */
export interface GlazingStrip {
  /** The back walls a marched room looks at. */
  readonly rooms: Banks
  /** The flat panels a window that marches nothing shows. */
  readonly panels: Banks
  readonly faces: Faces
}

/**
 * What burns in a room: the colours a lit window is tinted in, near and far.
 * Five of the eight are warm, because a street of lit windows after dark is
 * mostly tungsten and only some of it is the strip light in an office; the
 * saturated three are the accents `docs/LOOK.md` asks for.
 */
export const ROOM_TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [1.0, 0.87, 0.68],
  [1.0, 0.74, 0.45],
  [1.0, 0.9, 0.78],
  [1.0, 0.8, 0.55],
  [0.94, 0.96, 1.0],
  [0.62, 0.9, 1.0],
  [0.72, 1.0, 0.9],
  [1.0, 0.7, 0.87],
]
