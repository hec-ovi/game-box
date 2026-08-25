import type { Rng } from '@gb/kit'
import type { Face } from '../compose/faces.ts'
import type { Fascia } from './fascia.ts'
import { MARKS, SOLID } from './glyphs.ts'
import type { Neon } from './palette.ts'
import { backing } from './palette.ts'
import { between, wallOf, within, type Panel } from './place.ts'
import { across, bladeFor, down, lettersOf, panelFor } from './text.ts'

/**
 * The small lit things up the front: a strip of marks, a tube up the corner, a
 * board high on the wall. Each answers with the spots it would take, best
 * first, and the wall keeps the first one that is free.
 */

/** How wide a tube up the corner is: thin, but wide enough to hold a pixel down the street. */
const TUBE = 0.15

/** A narrow strip of marks, anywhere up the facade: a sign that says nothing and lights the wall anyway. */
export function stripOfMarks(front: Face, height: number, fascia: Fascia, doorAlong: number, hue: Neon, rng: Rng): Panel[] {
  const width = Math.min(0.52, bladeFor(fascia.letter))
  const tall = 1.9
  const up = between(fascia.top + 0.9 + rng.float() * Math.max(0, height - fascia.top - 2.8), tall, height)
  if (up === undefined) return []
  const side = rng.chance(0.5) ? 1 : -1
  const glyphs = down(Array.from({ length: 3 }, () => rng.pick(MARKS)), width, tall)
  const back = backing(rng)
  return [side, -side].map((way) => ({
    kind: 'sign' as const,
    mount: 'flat' as const,
    along: within(front, doorAlong + way * front.moduleWidth * 0.85, width),
    up,
    width,
    height: tall,
    ink: hue.ink,
    panel: back,
    glow: [hue.glow, 0],
    glyphs,
  }))
}

/** A tube up the edge of the facade, the cheapest light on the street. */
export function tube(front: Face, height: number, fascia: Fascia, hue: Neon, rng: Rng): Panel[] {
  const [bottom, finish] = [fascia.top + 0.3, height - 0.5]
  if (finish - bottom < 1.5) return []
  const side = rng.chance(0.5) ? 1 : -1
  const tall = finish - bottom
  return [side, -side].map((way) => ({
    kind: 'strip' as const,
    mount: 'flat' as const,
    along: way * (wallOf(front) / 2 - TUBE),
    up: (bottom + finish) / 2,
    width: TUBE,
    height: tall,
    ink: hue.ink,
    panel: 0x08090c,
    glow: [hue.glow * 1.1, 0],
    glyphs: [{ cell: SOLID, u: 0, v: 0, width: TUBE, height: tall }],
  }))
}

/** A board high on the wall, so the facade is lit all the way up rather than only where somebody can reach it. */
export function board(word: string, front: Face, height: number, fascia: Fascia, hue: Neon, rng: Rng): Panel[] {
  const wide = Math.min(wallOf(front) * 0.62, 2.7)
  const tall = panelFor(fascia.letter)
  const up = between(fascia.top + 2.4 + rng.float() * Math.max(0, height - fascia.top - 4.2), tall, height)
  if (up === undefined || height - fascia.top < 3.2) return []
  const written = rng.chance(0.45)
    ? across(Array.from({ length: 3 + rng.int(0, 2) }, () => rng.pick(MARKS)), wide, tall)
    : across(lettersOf(word), wide, tall)
  const side = rng.chance(0.5) ? 1 : -1
  const back = backing(rng)
  return [side, -side].map((way) => ({
    kind: 'sign' as const,
    mount: 'flat' as const,
    along: within(front, way * wallOf(front) * 0.22, wide),
    up,
    width: wide,
    height: tall,
    ink: hue.ink,
    panel: back,
    glow: [hue.glow, 0],
    glyphs: written,
  }))
}
