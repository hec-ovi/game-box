import type { Rng } from '@gb/kit'
import { METRICS, type Premise, type ResolvedCharter, type Word, type World } from '@gb/world'
import { openDoors, type Frontage } from '../interior/open.ts'
import { planInterior } from '../interior/plan.ts'
import type { InstanceRequest, PlaceRequest } from '../narrator.ts'
import { premiseLines } from '../premise/render.ts'
import type { Signs } from '../narrator/signs.ts'
import { bodyFor, itemsFor, occupancy, roleFor, surfacesOf } from '../populate.ts'
import { callsForDancing } from '../premise/wants.ts'
import { priceOf } from '../prices.ts'
import type { Chosen, PlannedInside, PlannedPost, PlannedSite, PlannedThing } from './planned.ts'

/** What the whole town needs before a single site can be planned. */
export interface RaiseSetup {
  readonly theme: string
  /** What the city is about, when a narrator wrote one. */
  readonly premise?: Premise
  readonly density: number
  readonly signs: Signs
  /** Which doors open, decided over the whole town at once. */
  readonly doors: Rng
  /** The stream every interior's people and things are drawn from. */
  readonly people: Rng
}

/**
 * Decides everything about a town's buildings that is arithmetic: which doors
 * open, what the shell of each open one looks like, who is standing in it and
 * what is lying about. Nothing here awaits anything, so the whole town is
 * planned before a narrator is asked a single question, and the questions can
 * then all go out together.
 */
export function planRaise(world: World, chosen: readonly Chosen[], setup: RaiseSetup): PlannedSite[] {
  const first = world.plots().length
  const demanded = new Set(setup.premise?.build.mustHave ?? [])
  const open = openDoors(frontagesOf(world, chosen, demanded), setup.doors, {
    built: first,
    open: world.interiors().flatMap((interior) => world.charter(interior.kind) ?? []),
  })
  const counts = { npcs: world.npcs().length, items: world.items().length }
  const style = `${setup.theme.split(/\s+/)[0]?.toLowerCase() ?? 'plain'}-`
  const story = setup.premise ? premiseLines(setup.premise) : undefined

  return chosen.map((one, at) => ({
    ...one,
    index: first + at,
    style: style + one.charter.word,
    sign: setup.signs.over(one.charter, setup.theme, first + at, story),
    ...(open.has(String(at)) ? { inside: planInside(world, one, setup, counts) } : {}),
  }))
}

/**
 * Every place that opens, asked for in one go, each one shown the town it
 * stands in.
 */
export function instanceRequests(planned: readonly PlannedSite[], setup: RaiseSetup): InstanceRequest[] {
  const premise = setup.premise ? premiseLines(setup.premise) : undefined
  return planned
    .filter((one): one is PlannedSite & { inside: PlannedInside } => one.inside !== undefined)
    .map((one) => ({
      kind: one.charter.word,
      charter: one.charter,
      theme: setup.theme,
      ...(premise ? { premise } : {}),
      index: one.index,
      rooms: one.inside.plan.rooms.map((room) => room.kind),
      posts: one.inside.posts.map((post) => ({ postId: post.anchor.id, role: post.role, index: post.index })),
      things: one.inside.things.map((thing) => ({ thingId: thing.thingId, archetype: thing.archetype, index: thing.index })),
    }))
}

/** Every door that does not open, for a narrator that hangs those signs itself. */
export function signRequests(planned: readonly PlannedSite[], setup: RaiseSetup): PlaceRequest[] {
  const premise = setup.premise ? premiseLines(setup.premise) : undefined
  return planned
    .filter((one) => one.inside === undefined)
    .map((one) => ({ kind: one.charter.word, charter: one.charter, theme: setup.theme, index: one.index, ...(premise ? { premise } : {}) }))
}

/**
 * The signs a narrator hung over the shut doors, in the order they were asked
 * for, put on their buildings: the nth shut door takes the nth answer, and one
 * the narrator left blank keeps the sign written here.
 */
export function hangSigns(planned: readonly PlannedSite[], signs: readonly string[]): PlannedSite[] {
  let answer = 0
  return planned.map((one) => {
    if (one.inside !== undefined) return one
    const sign = signs[answer++]?.trim()
    return sign ? { ...one, sign } : one
  })
}

/**
 * The buildings as the door ranking sees them. They are keyed by where they
 * stand in the list rather than by a plot id, because no plot exists yet: the
 * order is the order they were chosen in, which is the order they are minted
 * in, so the ranking breaks its ties exactly where it always did.
 */
function frontagesOf(world: World, chosen: readonly Chosen[], demanded: ReadonlySet<Word>): Frontage[] {
  const middle = { x: world.grid.width / 2, y: world.grid.height / 2 }
  const furthest = Math.hypot(middle.x, middle.y) || 1
  return chosen.map((one, at) => ({
    id: String(at),
    charter: one.charter,
    nearness: 1 - Math.hypot(one.site.entrance.x - middle.x, one.site.entrance.y - middle.y) / furthest,
    onAvenue: one.onAvenue,
    storied: demanded.has(one.charter.word),
  }))
}

/** Cuts the inside of one building and decides who is in it, without naming anybody. */
function planInside(world: World, one: Chosen, setup: RaiseSetup, counts: { npcs: number; items: number }): PlannedInside {
  const wall = METRICS.building.wallThickness
  const size = { w: one.site.rect.w * world.cellSize - wall * 2, h: one.site.rect.h * world.cellSize - wall * 2 }
  const plan = planInterior({
    charter: one.charter,
    size,
    entrance: one.site.facing,
    wants: { dancing: callsForDancing(setup.theme, setup.premise) },
    mint: (kind) => world.mintId(kind),
    rng: one.rng.fork('inside'),
  })
  const interiorId = world.mintId('interior')
  const rng = setup.people.fork(`people/${interiorId}`)

  const posts: PlannedPost[] = []
  for (const anchor of plan.anchors) {
    const role = roleFor(anchor.kind, one.charter)
    if (!role) continue
    // a staff post is always filled: a bar without a bartender is not a bar
    const chance = occupancy(anchor.kind, one.charter)
    if (chance < 1 && !rng.chance(chance * setup.density)) continue
    const index = counts.npcs++
    posts.push({ anchor, role, index, appearance: { base: bodyFor(rng), variant: rng.int(0, 8) } })
  }

  const surfaces = surfacesOf(plan.anchors)
  const things: PlannedThing[] = []
  for (const [at, archetype] of itemsFor(one.charter, rng).entries()) {
    const anchor = surfaces[at % Math.max(1, surfaces.length)]
    if (!anchor) break
    things.push({ thingId: `${interiorId}/thing/${at}`, archetype, anchorId: anchor.id, index: counts.items++, value: priceOf(archetype, rng) })
  }

  return { interiorId, size, plan, posts, things }
}
