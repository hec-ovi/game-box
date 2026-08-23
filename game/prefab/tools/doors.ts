import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Picture, type Rgb, type Tile } from './paint.ts'

/**
 * The two entrances the pack carries: one photograph, relit.
 *
 * A door is the surface a player stands closest to and, since only about one
 * building in eight opens, most of them are a door nobody will ever use and
 * still the nearest thing to the pavement. So it is a photograph rather than
 * rectangles: at 256 pixels stretched over a 2.2 m door that is a hundred
 * pixels to the metre, five times the wall's, and the frame, the push bar, the
 * kick plate and the reveals are all detail arithmetic cannot invent.
 *
 * `finishes/door.png` is committed art, ours, from our own prompt, and it is
 * stored already mirrored left over right. Half the plots in a city draw their
 * model mirrored, and a door whose hardware swapped hands with the building
 * would read as two different doors; symmetric, it reads the same both ways
 * round. It also covers the range the looks ask for, 1.4 m to 2.6 m wide, where
 * a single leaf at the top of that range is a cupboard door.
 */

/** Pixels a side the plate is drawn at. Twice the layer the pack stores, so the reader's marks land clean. */
const SIZE = 512

const PICTURE = resolve(import.meta.dirname, '../finishes/door.png')

/**
 * Everything the relight touches, in shares of the plate, read off the
 * committed picture's own row and column profiles. Nothing outside these
 * rectangles is ever changed, which is what makes the two entrances one door:
 * the frame, the push bar, the pulls, the kick plate and the wall are the
 * photograph, in both states.
 */
export const DOOR = {
  /** The fanlight over the leaves, and the two panes each leaf is split into by the push bar. */
  glazing: [
    { y0: 0.028, y1: 0.168 },
    { y0: 0.212, y1: 0.598 },
    { y0: 0.628, y1: 0.892 },
  ],
  /** The leaves across the picture, and the meeting stile down the middle that is not glass. */
  pane: { x0: 0.113, x1: 0.887 },
  stile: { x0: 0.472, x1: 0.528 },
  /** The threshold plate at the pavement, which is what throws light onto it. */
  threshold: { x0: 0.09, y0: 0.962, x1: 0.91, y1: 1 },
  /** The entry panel on the wall beside the frame, and its three lit marks. */
  call: { x0: 0.03, y0: 0.34, x1: 0.082, y1: 0.47 },
  mark: { inset: 0.011, first: 0.022, step: 0.032, tall: 0.012 },
} as const

const READER_BODY: Rgb = [17, 18, 21]

/** Warm inside, cool on a locked reader and green on one that will let you in. */
const LOBBY: Rgb = [255, 219, 170]
const READER: Rgb = [140, 240, 255]
const ADMITS: Rgb = [126, 255, 178]

/**
 * What tells the two entrances apart: how far the glass is lifted towards a lit
 * lobby, how hard it burns after dark, and what colour the reader's marks are.
 *
 * Everything else is the same photograph. A city of pavement-level doors that
 * all differ would read as noise, so the one you can walk through is the one
 * with its lights on: a lobby you can see into, a pool of light on the pavement
 * in front of it, and a reader that says it will admit you. It has to carry by
 * day as well, when nothing in the city glows, which is why the lit lobby is a
 * lighter surface and not only a stronger glow.
 */
interface Entrance {
  /** How far the glass is raised towards the lobby colour, at the head and at the sill. */
  readonly lit: { readonly head: number; readonly sill: number }
  /** After dark: the fanlight, the lobby, the light thrown on the pavement, the reader's marks. */
  readonly glow: { readonly transom: number; readonly lobby: number; readonly threshold: number; readonly reader: number }
  readonly mark: Rgb
}

const ENTRANCES = {
  /** Seven buildings in eight: the picture as it was taken, a dark lobby and a cool reader. */
  plain: {
    lit: { head: 0, sill: 0 },
    glow: { transom: 0.1, lobby: 0.22, threshold: 0.32, reader: 1.2 },
    mark: READER,
  },
  /** The one that opens: the lobby lights are on and the reader is green. */
  open: {
    lit: { head: 0.24, sill: 0.62 },
    glow: { transom: 0.36, lobby: 0.82, threshold: 0.98, reader: 1.5 },
    mark: ADMITS,
  },
} as const satisfies Record<string, Entrance>

export type EntranceKind = keyof typeof ENTRANCES

export async function doorTile(kind: EntranceKind = 'plain'): Promise<Tile> {
  const entrance: Entrance = ENTRANCES[kind]
  const picture = await Picture.of(await readFile(PICTURE), SIZE, 'door')

  for (const [index, band] of DOOR.glazing.entries()) {
    // the fanlight is one pane across the top; the leaves are split by the stile
    const spans = index === 0 ? [DOOR.pane] : [{ x0: DOOR.pane.x0, x1: DOOR.stile.x0 }, { x0: DOOR.stile.x1, x1: DOOR.pane.x1 }]
    const glow = index === 0 ? entrance.glow.transom : entrance.glow.lobby
    for (const span of spans) {
      picture.lift(
        { ...span, y0: band.y0, y1: band.y1 },
        { towards: LOBBY, by: entrance.lit.head, byTo: entrance.lit.sill, glow: glow * 0.45, glowTo: glow },
      )
    }
  }

  picture.lift(DOOR.threshold, { towards: LOBBY, by: entrance.lit.sill * 0.4, glow: entrance.glow.threshold })
  picture.paint(DOOR.call, { colour: READER_BODY })
  for (let mark = 0; mark < 3; mark++) {
    const y = DOOR.call.y0 + DOOR.mark.first + mark * DOOR.mark.step
    picture.paint(
      { x0: DOOR.call.x0 + DOOR.mark.inset, y0: y, x1: DOOR.call.x1 - DOOR.mark.inset, y1: y + DOOR.mark.tall },
      { colour: READER_BODY, glow: entrance.glow.reader, tint: entrance.mark },
    )
  }

  return await picture.tile()
}
