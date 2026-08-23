import { Rng } from '@gb/kit'
import type { Anchor, BuildingKind } from '@gb/world'
import { occupancy, roleFor, stockOf } from '../populate.ts'
import { planInterior } from './plan.ts'

/**
 * Which buildings you can walk into.
 *
 * A city is mostly frontage. Every plot gets a facade, a sign and a name from
 * the moment it goes up, but only some of them open, because a town where every
 * door leads to a generated room is a town with nothing behind any of them, and
 * because an interior is most of what a city costs to build and to carry.
 *
 * Nothing here reads a list of building kinds. A door is worth opening for what
 * the place has to offer, which this asks the interior planner: somebody
 * stationed at a post, somewhere to sit, somewhere to sleep, something lying
 * about. A kind added to `@gb/world` next week is weighed the same way without
 * anybody coming back here.
 */

/** Doors that open, per building the town put up. */
const SHARE = 0.12

/** How far the seed swings that either way. */
const SWING = 0.3

/** The fewest a town opens, however small it is: a handful is still a handful. */
const FEWEST = 6

/**
 * How far the seed may lift one door over another. Wide enough that a chapel on
 * the square sometimes opens and a shop out at the ring road sometimes does not,
 * so a town is not a list of its businesses.
 */
const NUDGE = 5

/** An anchor somebody is stationed at to do a job, rather than to pass the time. */
const WORKING = 0.6

/** The room a probe interior is planned in: big enough that nothing is left out for want of floor. */
const PROBE = { w: 11.6, h: 13.6 }

/** What a kind of place has to offer somebody who tries its door. */
export interface Draw {
  /** Posts that are always filled: somebody whose job is whoever walks in. */
  readonly counter: number
  /** Posts somebody works at: the people who make the place a place of work. */
  readonly staff: number
  /** Places a body sits: what makes a room read as somewhere people are. */
  readonly seats: number
  /** Places a body sleeps. */
  readonly beds: number
  /** Kinds of loose stock the place carries. */
  readonly stock: number
}

const draws = new Map<BuildingKind, Draw>()

/**
 * What this kind of building holds, read off an interior its own dresser makes
 * rather than off a table somebody has to maintain. Drawn once per kind from a
 * stream of its own, so it is the same everywhere and no town's seed moves it.
 */
export function drawOf(kind: BuildingKind): Draw {
  const known = draws.get(kind)
  if (known) return known
  let minted = 0
  const plan = planInterior({
    kind,
    size: PROBE,
    entrance: 'north',
    mint: (thing) => `${thing}_${++minted}`,
    rng: new Rng(`open/${kind}`),
  })
  const draw: Draw = {
    counter: plan.anchors.filter((anchor) => works(anchor, kind) && occupancy(anchor.kind) === 1).length,
    staff: plan.anchors.filter((anchor) => works(anchor, kind)).length,
    seats: plan.anchors.filter((anchor) => anchor.kind === 'sit' || anchor.kind === 'sit-drink').length,
    beds: plan.anchors.filter((anchor) => anchor.kind === 'sleep').length,
    stock: stockOf(kind).length,
  }
  draws.set(kind, draw)
  return draw
}

/** Somebody is stationed here often enough that it is their post, not a seat they took. */
function works(anchor: Anchor, kind: BuildingKind): boolean {
  return roleFor(anchor.kind, kind) !== undefined && occupancy(anchor.kind) >= WORKING
}

/**
 * How much a player has to gain from getting this door open. A counter with
 * somebody permanently behind it counts most, because that is a place whose
 * whole job is whoever walks in; then anybody else who works there, then what
 * is lying about, then whether the place reads as somewhere people are. It puts
 * a shop, a bar and a surgery well above a flat, a lock-up and a chapel, which
 * is the shape a town of frontage wants.
 */
export function pullOf(kind: BuildingKind): number {
  const draw = drawOf(kind)
  return (draw.counter ? 3 : 0) + (draw.staff ? 2 : 0) + (draw.stock >= 3 ? 1 : 0) + (draw.seats + draw.beds >= 3 ? 1 : 0)
}

/** What a town has to have somewhere, whatever else it opens. */
export const NEEDS: ReadonlyArray<readonly [string, (draw: Draw) => boolean]> = [
  ['somewhere to sit down', (draw) => draw.counter > 0 && draw.seats > 0],
  ['somewhere to buy something', (draw) => draw.counter > 0 && draw.stock > 0],
  ['somewhere to sleep', (draw) => draw.beds > 0],
  ['somewhere to work', (draw) => draw.staff > 0],
]

/** A building that has gone up, before anybody has decided whether it opens. */
export interface Frontage {
  readonly plotId: string
  readonly kind: BuildingKind
  /** How near the middle of town it stands, 1 at the centre and 0 at the edge. */
  readonly nearness: number
}

/**
 * Which of a town's buildings open, in the order they were put up.
 *
 * A share of the town, swung by the seed so two towns of a size do not open the
 * same number, and then the pick: what the place has to offer, how near the
 * middle of town it stands (a door on the way to everywhere gets tried, one at
 * the edge does not), and a seeded nudge so the same town twice over is not the
 * same list of shops. Whatever the ranking says, a town still ends up with
 * somewhere to sit, buy, sleep and work, because those are added first.
 */
export function openDoors(frontages: readonly Frontage[], rng: Rng): ReadonlySet<string> {
  if (!frontages.length) return new Set()
  const wanted = Math.min(frontages.length, Math.max(FEWEST, Math.round(frontages.length * SHARE * rng.range(1 - SWING, 1 + SWING))))

  const scored = frontages.map((frontage) => ({
    frontage,
    score: pullOf(frontage.kind) + frontage.nearness * 2 + rng.range(0, NUDGE),
  }))
  scored.sort((a, b) => b.score - a.score || (a.frontage.plotId < b.frontage.plotId ? -1 : 1))

  const open = new Set<string>()
  for (const [, met] of NEEDS) {
    const best = scored.find((candidate) => !open.has(candidate.frontage.plotId) && met(drawOf(candidate.frontage.kind)))
    if (best) open.add(best.frontage.plotId)
  }
  for (const candidate of scored) {
    if (open.size >= wanted) break
    open.add(candidate.frontage.plotId)
  }
  return open
}
