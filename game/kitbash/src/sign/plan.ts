import type { Rng } from '@gb/kit'
import type { Plot } from '@gb/world'
import type { PlotCharter } from '../charter.ts'
import type { Band } from '../compose/bands.ts'
import type { Face } from '../compose/faces.ts'
import { board, stripOfMarks, tube } from './accents.ts'
import { checkSignage } from './bounds.ts'
import type { WallClaims } from './claims.ts'
import { doorLamps } from './doorlamp.ts'
import { fasciaOf, signWall, type Fascia } from './fascia.ts'
import { againstNeon, backing, houseNeon, LIGHTBOX, type Neon } from './palette.ts'
import { alongOf, between, place, wallOf, within, type Panel } from './place.ts'
import { SIGN, type Sign } from './sign.ts'
import { across, bladeFor, down, lettersOf, panelFor, widthFor } from './text.ts'

/**
 * Where a building's signs go. Every plot gets its own name over the door and
 * a lamp either side of it; a trade gets a blade down the front, something
 * hanging out over the street and a few small lit things up the wall, as often
 * as its charter says it shouts, and the blade spells the word the charter
 * gave it.
 *
 * Every letter is sized off the fascia, and every panel claims its patch of
 * the building's walls before it is drawn, so nothing is drawn through
 * anything else, a camera hung later included. Nothing
 * here draws from a stream anything else uses, so signage can be tuned without
 * moving the windows of a city that already exists.
 */

/** The tall blade down the front of the building. */
const BLADE = { widest: 0.95, clear: 0.55, shortest: 2.4 } as const

/** What hangs out over the street: how high above the shopfront, and how deep. */
const HANGING = { high: 0.95, tall: 0.64, longest: 3.1 } as const

export function planSigns(plot: Plot, charter: PlotCharter, height: number, faces: readonly Face[], front: Face, doorModule: number, bands: readonly Band[], rng: Rng, claims: WallClaims): Sign[] {
  checkSignage(charter.signage)
  const { signage: trade, blade: word } = charter
  const hue = houseNeon(rng)
  const fascia = fasciaOf(bands[0] ?? { base: 0, height })
  // everything below is sized and placed against the top of the wall signage
  // may use, never the building: a tower is a shopfront with window wall over it
  const top = signWall(fascia, height)
  const doorAlong = alongOf(front, doorModule)
  const signs: Sign[] = []
  const hang = (face: Face, candidates: readonly Panel[]): void => {
    const sign = place(face, candidates, claims)
    if (sign) signs.push(sign)
  }

  hang(front, [nameplate(plot, front, fascia, top, doorAlong, hue, trade.nameplate, rng)])
  for (const lamp of doorLamps(doorAlong)) hang(front, [lamp])

  if (rng.chance(trade.blade)) {
    const face = rng.chance(0.72) ? front : rng.pick(faces.filter((one) => one.id !== front.id))
    hang(face, blade(word, face, fascia, top, againstNeon(rng, hue), rng))
  }
  if (rng.chance(trade.hanging)) hang(front, boxOverTheStreet(plot.name, word, front, fascia, top, doorAlong, hue, rng))

  // the door lamps are the first accent every trade carries; the rest come as loud as the trade is
  for (let at = 1; at < trade.accents; at++) {
    const colour = againstNeon(rng, hue)
    if (at === 1) hang(front, stripOfMarks(front, top, fascia, doorAlong, colour, rng))
    else if (at === 2) hang(front, tube(front, top, fascia, colour, rng))
    else hang(front, board(word, front, top, fascia, colour, rng))
  }

  return signs
}

/** The name over the door, in the fascia: every building has one, however quiet its trade. */
function nameplate(plot: Plot, front: Face, fascia: Fascia, wallHeight: number, doorAlong: number, hue: Neon, loud: number, rng: Rng): Panel {
  const height = panelFor(fascia.letter) * (loud < 0.5 ? 0.62 : 1)
  const name = lettersOf(plot.name)
  const width = Math.min(wallOf(front) - 0.24, Math.max(front.moduleWidth * 1.1, widthFor(name, height)))
  const lightbox = loud >= 1 && rng.chance(0.3)

  return {
    kind: 'sign',
    mount: 'flat',
    along: within(front, doorAlong, width),
    up: between((fascia.bottom + fascia.top) / 2, height, wallHeight) ?? (fascia.bottom + fascia.top) / 2,
    width,
    height,
    ink: lightbox ? 0x0b0c10 : hue.ink,
    panel: lightbox ? hue.ink : backing(rng),
    glow: lightbox ? [0, LIGHTBOX * loud] : [hue.glow * loud, 0],
    glyphs: across(name, width, height),
  }
}

/** A tall blade spelling what kind of place this is: flat on the wall, or hung off it. Either end of the wall will do. */
function blade(word: string, wall: Face, fascia: Fascia, height: number, hue: Neon, rng: Rng): Panel[] {
  const bottom = fascia.top + 0.35
  const finish = height - BLADE.clear
  if (finish - bottom < BLADE.shortest) return []

  // the letters run down a column sized off the fascia; a hung blade is as deep as the wall allows round them
  const deep = Math.min(BLADE.widest, wall.moduleWidth * 0.55)
  const width = Math.min(deep, bladeFor(fascia.letter))
  const side = rng.chance(0.5) ? 1 : -1
  const tall = finish - bottom
  const back = backing(rng)
  const hung = rng.chance(0.45)
  const hang = Math.min(tall, HANGING.longest)
  const [mount, long, high, up] = hung
    ? ['hung' as const, deep, hang, finish - hang / 2]
    : ['flat' as const, width, tall, (bottom + finish) / 2]
  const glyphs = down(lettersOf(word), width, high)

  return [side, -side].map((way) => ({
    kind: 'sign' as const,
    mount,
    along: way * (wallOf(wall) / 2 - width / 2 - 0.2),
    up,
    width: long,
    height: high,
    ink: hue.ink,
    panel: back,
    glow: [hue.glow * (hung ? 1.1 : 1), 0],
    glyphs,
  }))
}

/** The box out over the pavement, which is what gives a street its depth. Either side of the door will do. */
function boxOverTheStreet(name: string, word: string, front: Face, fascia: Fascia, height: number, doorAlong: number, hue: Neon, rng: Rng): Panel[] {
  const tall = Math.min(HANGING.tall, panelFor(fascia.letter))
  const up = between(fascia.top + HANGING.high, tall, height)
  if (up === undefined) return []

  const side = rng.chance(0.5) ? 1 : -1
  const long = SIGN.reach
  // the name only if the whole of it fits: half a name is worse than no name
  const letters = lettersOf(name)
  const written = rng.chance(0.5) && widthFor(letters, tall) <= long ? letters : lettersOf(word)
  const back = backing(rng)
  const glyphs = across(written, long, tall)
  return [side, -side].map((way) => ({
    kind: 'sign' as const,
    mount: 'hung' as const,
    along: within(front, doorAlong + way * front.moduleWidth, 0.8),
    up,
    width: long,
    height: tall,
    ink: hue.ink,
    panel: back,
    glow: [hue.glow * 1.1, 0],
    glyphs,
  }))
}
