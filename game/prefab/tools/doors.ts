import { Picture, type Rgb, type Tile } from './paint.ts'

/**
 * The two entrances the pack carries, drawn from code.
 *
 * A door is the surface a player stands closest to and, since only about one
 * building in eight opens, most of them are a door nobody will ever use and
 * still the nearest thing to the pavement. It is drawn rather than photographed
 * for the same reason `@gb/kitbash` draws its sign letters: it is rectangles in
 * shares of the leaf, which the producer stretches over whatever door the look
 * asked for, so one picture fits every door in the city at the size it really
 * is, and it comes out the same on every machine.
 */

/** Pixels a side. The plate the producer stretches over a leaf. */
const SIZE = 256

/**
 * The entrance, drawn on the one leaf the producer builds.
 *
 * A door is the surface a player stands closest to and, since only about one
 * building in eight opens, most of them are a door nobody will ever use and
 * still the nearest thing to the pavement. So it is drawn the way the pier and
 * the spandrel are: rectangles in shares of the leaf, which the producer
 * stretches over whatever door the look asked for.
 *
 * It is a pair of glazed leaves, and it is symmetric on purpose. A model is
 * mirrored onto half the plots in the city and a single leaf with its handle on
 * one side would swap hands with the building; a meeting stile down the middle
 * with a pull either side reads the same both ways round. The whole set of
 * doors the looks ask for runs 1.4 m to 2.6 m wide, and a pair covers that
 * range where one leaf would look like a cupboard at the top of it.
 *
 * The left twenty-fifth of the picture is the strip the producer wraps round
 * the reveals of the plate, so the frame is drawn wider than that and the
 * reveals come out frame-coloured rather than carrying a slice of glass.
 */
const DOOR = {
  /** The frame all round, wider than the 0.04 the reveals wear. */
  frame: 0.055,
  /** The lit fanlight over the leaves. */
  transom: 0.215,
  /** Half the meeting stile, either side of the middle. */
  meeting: 0.013,
  /** The upright at the outer edge of each leaf. */
  stile: 0.05,
  glass: { top: 0.265, low: 0.715 },
  rail: { top: 0.715, low: 0.775 },
  kick: { top: 0.885, low: 0.945 },
  sill: 0.955,
  /** The pull: how far in from the meeting stile, how wide, and how far down the leaf it runs. */
  pull: { off: 0.045, wide: 0.016, top: 0.44, low: 0.63 },
  /** The entry panel on the frame: a reader and its three lit marks. */
  call: { x0: 0.062, x1: 0.128, y0: 0.34, y1: 0.47 },
} as const

const DOOR_TONES = {
  frame: [30, 32, 36],
  leaf: [23, 25, 29],
  meeting: [14, 15, 18],
  glassTop: [10, 16, 19],
  glassLow: [24, 37, 41],
  rail: [38, 41, 45],
  kick: [44, 47, 51],
  sill: [52, 54, 58],
  pull: [126, 134, 142],
  reader: [17, 18, 21],
} as const satisfies Record<string, Rgb>

/** Warm inside, cool on a locked reader and green on one that will let you in. */
const LOBBY: Rgb = [255, 219, 170]
const READER: Rgb = [140, 240, 255]
const ADMITS: Rgb = [126, 255, 178]

/**
 * What tells the two entrances apart: the lobby behind the glass, how hard it
 * burns after dark, and what colour the reader's marks are.
 *
 * Everything else is the same door. A city of pavement-level doors that all
 * differ would read as noise, so the one you can walk through is the one with
 * its lights on: a lobby you can see into, a pool of light on the pavement in
 * front of it, and a reader that says it will admit you. It has to carry by day
 * as well, when nothing in the city glows, so the lit lobby is a lighter warm
 * surface and not only a stronger glow.
 */
interface Entrance {
  /** The lobby behind the glass, at the head of the pane and at the sill. */
  readonly glass: { readonly top: Rgb; readonly low: Rgb }
  /** The threshold plate at the pavement. */
  readonly sill: Rgb
  /** After dark: the fanlight, the lobby, the light thrown on the pavement, the reader's marks. */
  readonly glow: { readonly transom: number; readonly lobby: number; readonly threshold: number; readonly reader: number }
  readonly mark: Rgb
}

const ENTRANCES = {
  /** Seven buildings in eight: a dark lobby behind the glass and a cool reader. */
  plain: {
    glass: { top: DOOR_TONES.glassTop, low: DOOR_TONES.glassLow },
    sill: DOOR_TONES.sill,
    glow: { transom: 0.1, lobby: 0.22, threshold: 0.32, reader: 1.2 },
    mark: READER,
  },
  /** The one that opens: the lobby lights are on and the reader is green. */
  open: {
    glass: { top: [30, 27, 22], low: [116, 101, 78] },
    sill: [92, 84, 70],
    glow: { transom: 0.36, lobby: 0.82, threshold: 0.98, reader: 1.5 },
    mark: ADMITS,
  },
} as const satisfies Record<string, Entrance>

export type EntranceKind = keyof typeof ENTRANCES

export async function doorTile(kind: EntranceKind = 'plain'): Promise<Tile> {
  const entrance: Entrance = ENTRANCES[kind]
  const picture = new Picture(SIZE, 'door')
  const middle = 0.5

  picture.paint({ x0: 0, y0: 0, x1: 1, y1: 1 }, { colour: DOOR_TONES.frame, grain: 1.6 })
  picture.paint(
    { x0: DOOR.frame, y0: DOOR.frame, x1: 1 - DOOR.frame, y1: DOOR.transom },
    { colour: entrance.glass.top, to: entrance.glass.low, glow: entrance.glow.transom * 0.7, glowTo: entrance.glow.transom, tint: LOBBY },
  )
  picture.paint({ x0: DOOR.frame, y0: DOOR.transom, x1: 1 - DOOR.frame, y1: 1 - DOOR.frame }, { colour: DOOR_TONES.leaf, grain: 1.2 })

  for (const leaf of [
    { x0: DOOR.frame + DOOR.stile, x1: middle - DOOR.meeting - DOOR.stile * 0.6 },
    { x0: middle + DOOR.meeting + DOOR.stile * 0.6, x1: 1 - DOOR.frame - DOOR.stile },
  ]) {
    picture.paint(
      { ...leaf, y0: DOOR.glass.top, y1: DOOR.glass.low },
      { colour: entrance.glass.top, to: entrance.glass.low, glow: 0, glowTo: entrance.glow.lobby, tint: LOBBY },
    )
    picture.paint({ ...leaf, y0: DOOR.rail.top, y1: DOOR.rail.low }, { colour: DOOR_TONES.rail, grain: 1 })
    picture.paint({ ...leaf, y0: DOOR.kick.top, y1: DOOR.kick.low }, { colour: DOOR_TONES.kick, grain: 1.4 })
  }

  picture.paint({ x0: middle - DOOR.meeting, y0: DOOR.transom, x1: middle + DOOR.meeting, y1: 1 - DOOR.frame }, { colour: DOOR_TONES.meeting })
  for (const side of [-1, 1]) {
    const near = middle + side * (DOOR.meeting + DOOR.pull.off)
    const far = near + side * DOOR.pull.wide
    picture.paint({ x0: Math.min(near, far), y0: DOOR.pull.top, x1: Math.max(near, far), y1: DOOR.pull.low }, { colour: DOOR_TONES.pull, grain: 3 })
  }

  picture.paint({ x0: DOOR.frame, y0: DOOR.sill, x1: 1 - DOOR.frame, y1: 1 }, { colour: entrance.sill, glow: entrance.glow.threshold, tint: LOBBY })
  picture.paint(DOOR.call, { colour: DOOR_TONES.reader })
  for (let mark = 0; mark < 3; mark++) {
    const y = DOOR.call.y0 + 0.022 + mark * 0.032
    picture.paint(
      { x0: DOOR.call.x0 + 0.014, y0: y, x1: DOOR.call.x1 - 0.014, y1: y + 0.012 },
      { colour: DOOR_TONES.reader, glow: entrance.glow.reader, tint: entrance.mark },
    )
  }

  return await picture.tile()
}
