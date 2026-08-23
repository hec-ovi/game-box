import type { Rng } from '@gb/kit'
import type { BuildingKind, Plot } from '@gb/world'
import type { Band } from '../compose/bands.ts'
import type { Face } from '../compose/faces.ts'
import { MARKS, SOLID } from './glyphs.ts'
import { againstNeon, backing, DOORLIGHT, houseNeon, type Neon } from './palette.ts'
import { outward, SIGN, type Sign, type Written } from './sign.ts'
import { across, down, lettersOf, widthFor } from './text.ts'
import { SIGNAGE, TRADE_WORD } from './trade.ts'

/**
 * Where a building's signs go. Every plot gets its own name over the door; a
 * trade gets a blade down the front, something hanging out over the street and
 * a few small lit things round the doorway, as often as its trade shouts.
 *
 * Nothing here draws from a stream anything else uses, so signage can be tuned
 * without moving the windows of a city that already exists.
 */

/** The name over the door. */
const NAMEPLATE = { height: 0.74, drop: 0.48 } as const

/** The tall blade down the front of the building. */
const BLADE = { width: 0.95, clear: 0.55, shortest: 2.4 } as const

/** How wide a tube up the corner is: thin, but wide enough to hold a pixel down the street. */
const TUBE = 0.15

/** What hangs out over the street: how high above the shopfront, and how deep. */
const HANGING = { high: 0.95, tall: 0.64, longest: 3.1 } as const

export function planSigns(plot: Plot, height: number, faces: readonly Face[], front: Face, doorModule: number, bands: readonly Band[], rng: Rng): Sign[] {
  const trade = SIGNAGE[plot.kind]
  const hue = houseNeon(rng)
  const ground = bands[0] ?? { base: 0, height }
  const top = ground.base + ground.height
  const signs: Sign[] = [nameplate(plot, front, doorModule, top, height, hue, trade.nameplate, rng)]

  if (rng.chance(trade.blade)) {
    const wall = rng.chance(0.72) ? front : rng.pick(faces.filter((face) => face.id !== front.id))
    signs.push(...blade(plot, wall, top, height, againstNeon(rng, hue), rng))
  }
  if (rng.chance(trade.hanging)) signs.push(...boxOverTheStreet(plot, front, doorModule, top, height, hue, rng))
  for (let at = 0; at < trade.accents; at++) signs.push(...accent(plot.kind, front, doorModule, top, height, at === 0 ? hue : againstNeon(rng, hue), at, rng))

  return signs
}

/** A point on a wall plane: `along` metres right of its middle, `up` above the pavement, `out` off the face. */
function on(face: Face, along: number, up: number, out: number): readonly [number, number, number] {
  const away = outward(face.right)
  return [face.origin[0] + face.right[0] * along + away[0] * out, up, face.origin[1] + face.right[1] * along + away[1] * out]
}

/** Where the middle of a module sits along its wall. */
function alongOf(face: Face, module: number): number {
  return (module + 0.5) * face.moduleWidth - wallOf(face) / 2
}

function wallOf(face: Face): number {
  return face.modules * face.moduleWidth
}

/** Keeps a panel of `tall` between the pavement and the parapet, or says it will not fit. */
function onWall(up: number, tall: number, height: number): number | undefined {
  const lowest = 0.45 + tall / 2
  const highest = height - 0.1 - tall / 2
  return highest < lowest ? undefined : Math.max(lowest, Math.min(highest, up))
}

/** Keeps a panel of `width` inside the wall it is on. */
function within(face: Face, along: number, width: number): number {
  const reach = Math.max(0, wallOf(face) / 2 - width / 2 - 0.12)
  return Math.max(-reach, Math.min(reach, along))
}

/** The name over the door: every building has one, however quiet its trade. */
function nameplate(plot: Plot, front: Face, doorModule: number, top: number, wallHeight: number, hue: Neon, loud: number, rng: Rng): Sign {
  const height = NAMEPLATE.height * (loud < 0.5 ? 0.62 : 1)
  const name = lettersOf(plot.name)
  const width = Math.min(wallOf(front) - 0.24, Math.max(front.moduleWidth * 1.1, widthFor(name, height)))
  const lightbox = loud >= 1 && rng.chance(0.3)

  return {
    origin: on(front, within(front, alongOf(front, doorModule), width), onWall(top - NAMEPLATE.drop, height, wallHeight) ?? top - NAMEPLATE.drop, SIGN.stand),
    right: front.right,
    width,
    height,
    ink: lightbox ? 0x0b0c10 : hue.ink,
    panel: lightbox ? hue.ink : backing(rng),
    glow: lightbox ? [0, hue.glow * 1.4 * loud] : [hue.glow * loud, 0],
    glyphs: [...across(name, width, height), ...(rng.chance(0.42) ? edging(width, height) : [])],
  }
}

/** A tall blade spelling what kind of place this is: flat on the wall, or hung off it. */
function blade(plot: Plot, wall: Face, top: number, height: number, hue: Neon, rng: Rng): Sign[] {
  const bottom = top + 0.35
  const finish = height - BLADE.clear
  if (finish - bottom < BLADE.shortest) return []

  const width = Math.min(BLADE.width, wall.moduleWidth * 0.55)
  const along = (rng.chance(0.5) ? 1 : -1) * (wallOf(wall) / 2 - width / 2 - 0.2)
  const tall = finish - bottom
  const word = lettersOf(TRADE_WORD[plot.kind])
  const back = backing(rng)

  if (rng.chance(0.45)) {
    const hang = Math.min(tall, HANGING.longest)
    return hung(wall, along, finish - hang / 2, width, hang, down(word, width, hang), hue, back)
  }
  return [{
    origin: on(wall, along, (bottom + finish) / 2, SIGN.stand),
    right: wall.right,
    width,
    height: tall,
    ink: hue.ink,
    panel: back,
    glow: [hue.glow, 0],
    glyphs: [...down(word, width, tall), ...edging(width, tall)],
  }]
}

/** The box out over the pavement, which is what gives a street its depth. */
function boxOverTheStreet(plot: Plot, front: Face, doorModule: number, top: number, height: number, hue: Neon, rng: Rng): Sign[] {
  const up = onWall(top + HANGING.high, HANGING.tall, height)
  if (up === undefined) return []

  const step = (rng.chance(0.5) ? 1 : -1) * front.moduleWidth
  const along = within(front, alongOf(front, doorModule) + step, 0.8)
  const long = SIGN.reach
  // the name only if the whole of it fits: half a name is worse than no name
  const name = lettersOf(plot.name)
  const word = rng.chance(0.5) && widthFor(name, HANGING.tall) <= long ? name : lettersOf(TRADE_WORD[plot.kind])
  return hung(front, along, up, long, HANGING.tall, across(word, long, HANGING.tall), hue, backing(rng))
}

/** One panel hanging off a wall, seen from both sides. */
function hung(face: Face, along: number, up: number, long: number, tall: number, glyphs: readonly Written[], hue: Neon, back: number): Sign[] {
  const away = outward(face.right)
  const origin = on(face, along, up, SIGN.stand + long / 2)
  const written = [...glyphs, ...edging(long, tall)]
  const facings = [[-away[0], -away[1]], away] as const

  return facings.map((right) => ({
    origin,
    right: right as readonly [number, number],
    width: long,
    height: tall,
    ink: hue.ink,
    panel: back,
    glow: [hue.glow * 1.1, 0] as const,
    glyphs: written,
  }))
}

/** The small lit things: a doorlight, a strip of marks, a tube up the corner. */
function accent(kind: BuildingKind, front: Face, doorModule: number, top: number, height: number, hue: Neon, index: number, rng: Rng): Sign[] {
  if (index === 0) {
    // the lit doorway: a warm bar under the nameplate, over the door itself
    const width = front.moduleWidth * 0.84
    const up = onWall(top - NAMEPLATE.height - 0.26, 0.11, height)
    if (up === undefined) return []
    return [{
      origin: on(front, within(front, alongOf(front, doorModule), width), up, SIGN.stand),
      right: front.right,
      width,
      height: 0.11,
      ink: DOORLIGHT.ink,
      panel: 0x08090c,
      glow: [DOORLIGHT.glow, 0],
      glyphs: [{ cell: SOLID, u: 0, v: 0, width, height: 0.11 }],
    }]
  }

  if (index === 1) {
    // a narrow strip of marks, anywhere up the facade: a sign that says nothing
    // and lights the wall anyway, which is most of the signage on a real street
    const [width, tall] = [0.52, 1.9]
    const up = onWall(top + 0.9 + rng.float() * Math.max(0, height - top - 2.8), tall, height)
    if (up === undefined) return []
    const along = within(front, alongOf(front, doorModule) + (rng.chance(0.5) ? 1 : -1) * front.moduleWidth * 0.85, width)
    return [{
      origin: on(front, along, up, SIGN.stand),
      right: front.right,
      width,
      height: tall,
      ink: hue.ink,
      panel: backing(rng),
      glow: [hue.glow, 0],
      glyphs: down(Array.from({ length: 3 }, () => rng.pick(MARKS)), width, tall),
    }]
  }

  if (index === 2) return [tube(front, top, height, hue, rng)].filter((sign) => sign !== undefined)

  // a board high on the wall, so the facade is lit all the way up rather than
  // only where somebody can reach it
  const board = Math.min(wallOf(front) * 0.62, 2.7)
  const tall = 1.15
  const up = onWall(top + 2.4 + rng.float() * Math.max(0, height - top - 4.2), tall, height)
  if (up === undefined || height - top < 3.2) return []
  const written = rng.chance(0.45)
    ? across(Array.from({ length: 3 + rng.int(0, 2) }, () => rng.pick(MARKS)), board, tall)
    : across(lettersOf(TRADE_WORD[kind]), board, tall)
  return [{
    origin: on(front, within(front, (rng.chance(0.5) ? 1 : -1) * wallOf(front) * 0.22, board), up, SIGN.stand),
    right: front.right,
    width: board,
    height: tall,
    ink: hue.ink,
    panel: backing(rng),
    glow: [hue.glow, 0],
    glyphs: [...written, ...edging(board, tall)],
  }]
}

/** A tube up the edge of the facade, the cheapest light on the street. */
function tube(front: Face, top: number, height: number, hue: Neon, rng: Rng): Sign | undefined {
  const [bottom, finish] = [top + 0.3, height - 0.5]
  if (finish - bottom < 1.5) return undefined
  const along = (rng.chance(0.5) ? 1 : -1) * (wallOf(front) / 2 - TUBE)
  return {
    origin: on(front, along, (bottom + finish) / 2, SIGN.stand),
    right: front.right,
    width: TUBE,
    height: finish - bottom,
    ink: hue.ink,
    panel: 0x08090c,
    glow: [hue.glow * 1.1, 0],
    glyphs: [{ cell: SOLID, u: 0, v: 0, width: TUBE, height: finish - bottom }],
  }
}

/** Four thin tubes round the edge of a panel: a lit box rather than a painted one. */
function edging(width: number, height: number): Written[] {
  const thick = Math.min(0.05, height * 0.1)
  return [
    { cell: SOLID, u: 0, v: (height - thick) / 2, width, height: thick },
    { cell: SOLID, u: 0, v: -(height - thick) / 2, width, height: thick },
    { cell: SOLID, u: (width - thick) / 2, v: 0, width: thick, height },
    { cell: SOLID, u: -(width - thick) / 2, v: 0, width: thick, height },
  ]
}
