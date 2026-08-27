import type { Rng } from '@gb/kit'
import { METRICS, type Premise, type ResolvedCharter, type Word, type World } from '@gb/world'
import { openDoors, type Frontage } from '../interior/open.ts'
import { planInterior } from '../interior/plan.ts'
import { nearnessIn } from '../layout/plots.ts'
import type { InstanceBrief, InstanceCasting, InstanceRequest, PlaceRequest } from '../narrator.ts'
import { premiseLines } from '../premise/render.ts'
import type { Signs } from '../narrator/signs.ts'
import type { StreetNames } from '../narrator/streets.ts'
import { bodyFor, itemsFor, keeperOf, roleFor, surfacesOf } from '../populate.ts'
import { callsForDancing } from '../premise/wants.ts'
import { priceOf } from '../prices.ts'
import { putUpForSale } from './homes.ts'
import { narrated, type Chosen, type PlannedInside, type PlannedPost, type PlannedSite, type PlannedThing } from './planned.ts'

/** What the whole town needs before a single site can be planned. */
export interface RaiseSetup {
  readonly theme: string
  /** What the city is about, when a narrator wrote one. */
  readonly premise?: Premise
  /** How many places the city opens, whatever its size. */
  readonly places: number
  readonly signs: Signs
  /** What every street in the town is called. */
  readonly streets: StreetNames
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
    open: world.interiors().flatMap((interior) => {
      const charter = world.charter(interior.kind)
      const plot = world.plot(interior.plotId)
      return charter && plot ? [{ charter, spot: plot.entrance.cell }] : []
    }),
    span: Math.max(world.grid.width, world.grid.height),
    places: setup.places,
  })
  const counts = { npcs: world.npcs().length, items: world.items().length }
  const style = `${setup.theme.split(/\s+/)[0]?.toLowerCase() ?? 'plain'}-`
  const story = setup.premise ? premiseLines(setup.premise) : undefined

  const planned = chosen.map((one, at): PlannedSite => {
    const street = setup.streets.at(one.site.entrance, one.site.facing)
    // a facade that was already standing keeps its number and its sign: the
    // street reads as it always did, and its people are drawn where they were
    const index = one.standing?.index ?? first + at
    return {
      ...one,
      index,
      style: style + one.charter.word,
      sign: one.standing?.name ?? setup.signs.over(one.charter, setup.theme, index, { premise: story, street }),
      ...(street ? { street } : {}),
      ...(open.has(String(at)) ? { inside: planInside(world, one, setup, counts) } : {}),
    }
  })
  // a home for the player is a fact about the whole town, so it is picked once the town is planned
  return putUpForSale(planned, counts, () => world.mintId('item'), setup.people.fork('sale'))
}

/** One building as every narrator is shown it: what it is, the street it is on, and the town's story. */
function placeRequest(one: PlannedSite, setup: RaiseSetup, premise: string | undefined): PlaceRequest {
  return {
    kind: one.charter.word,
    charter: one.charter,
    theme: setup.theme,
    index: one.index,
    ...(one.street ? { street: one.street } : {}),
    ...(premise ? { premise } : {}),
  }
}

/** Nothing the work asks of a place, which is what most places get asked. */
const nothing = (): readonly never[] => []

/**
 * Every place that opens, asked for in one go, each one shown the town it
 * stands in, the name it was given and the people the town's work already
 * needs standing in it.
 */
export function instanceRequests(
  planned: readonly PlannedSite[],
  setup: RaiseSetup,
  cast: (one: PlannedSite) => readonly InstanceCasting[] = nothing,
): InstanceRequest[] {
  const premise = setup.premise ? premiseLines(setup.premise) : undefined
  return planned
    .filter((one): one is PlannedSite & { inside: PlannedInside } => one.inside !== undefined)
    .map((one) => ({
      ...placeRequest(one, setup, premise),
      name: one.sign,
      rooms: one.inside.plan.rooms.map((room) => room.kind),
      posts: one.inside.posts.map((post) => ({ postId: post.anchor.id, role: post.role, index: post.index })),
      things: one.inside.things.filter(narrated).map((thing) => ({ thingId: thing.thingId, archetype: thing.archetype, index: thing.index })),
      has: briefOf(one.inside),
      cast: cast(one),
    }))
}

/** What the plan put in a place beyond its people and its stock, in the words a writer builds a line on. */
function briefOf(inside: PlannedInside): InstanceBrief {
  const { plan } = inside
  const named = new Map(plan.rooms.map((room) => [room.id, room.name]))
  return {
    locked: plan.doors
      .filter((door) => door.locked)
      .map((door) => ({ room: named.get(door.to) ?? door.to, by: door.password ? 'code' : plan.keys.find((key) => key.doorId === door.id)?.archetype === 'keycard' ? 'card' : 'key' })),
    machines: plan.furniture.filter((piece) => piece.machine).map((piece) => ({ room: named.get(piece.roomId) ?? piece.roomId, program: piece.machine!.program })),
    camera: plan.furniture.some((piece) => piece.prop === 'camera'),
    ...(inside.forSale !== undefined ? { forSale: inside.forSale } : {}),
  }
}

/**
 * Every door this pass puts up, for whoever names them: the ones that open as
 * well as the frontage, because a place is named after the work is written and
 * every sign in the town comes out of the same call. A building already
 * standing keeps the sign it has and is not asked about.
 */
export function nameRequests(planned: readonly PlannedSite[], setup: RaiseSetup, work: (one: PlannedSite) => readonly string[] = nothing): PlaceRequest[] {
  const premise = setup.premise ? premiseLines(setup.premise) : undefined
  return planned.filter(wantsName).map((one) => {
    const doing = work(one)
    return { ...placeRequest(one, setup, premise), ...(doing.length ? { work: doing } : {}) }
  })
}

/**
 * The signs a narrator hung, in the order they were asked for, put on their
 * buildings: the nth door takes the nth answer, and one the narrator left blank
 * keeps the sign composed here.
 */
export function hangSigns(planned: readonly PlannedSite[], signs: readonly string[]): PlannedSite[] {
  let answer = 0
  return planned.map((one) => {
    if (!wantsName(one)) return one
    const sign = signs[answer++]?.trim()
    return sign ? { ...one, sign } : one
  })
}

/** A door this pass put up, so its sign is this pass's to write. */
export const wantsName = (one: PlannedSite): boolean => one.standing === undefined

/**
 * The buildings as the door ranking sees them. They are keyed by where they
 * stand in the list rather than by a plot id, because no plot exists yet: the
 * order is the order they were chosen in, which is the order they are minted
 * in, so the ranking breaks its ties exactly where it always did.
 */
function frontagesOf(world: World, chosen: readonly Chosen[], demanded: ReadonlySet<Word>): Frontage[] {
  return chosen.map((one, at) => ({
    id: String(at),
    charter: one.charter,
    spot: one.site.entrance,
    floor: one.site.rect.w * one.site.rect.h,
    nearness: nearnessIn(world.grid, one.site.entrance),
    onAvenue: one.onAvenue,
    storied: demanded.has(one.charter.word),
  }))
}

/** Cuts the inside of one building and decides who is in it, without naming anybody. */
function planInside(world: World, one: Chosen, setup: RaiseSetup, counts: { npcs: number; items: number }): PlannedInside {
  const wall = METRICS.building.wallThickness
  const size = { w: one.site.rect.w * world.cellSize - wall * 2, h: one.site.rect.h * world.cellSize - wall * 2 }
  const interiorId = world.mintId('interior')
  const plan = planInterior({
    charter: one.charter,
    size,
    entrance: one.site.facing,
    wants: { dancing: callsForDancing(setup.theme, setup.premise) },
    interiorId,
    mint: (kind) => world.mintId(kind),
    rng: one.rng.fork('inside'),
  })
  const rng = setup.people.fork(`people/${interiorId}`)
  // whoever keeps the keys: a lock without its keeper is a lock nobody can write a quest through
  const keeper = keeperOf(plan.anchors, one.charter)
  // a city opens a handful of places and its whole cast stands in them, so every
  // post in one is filled: an empty stool in a town of three doors is a third of
  // the people the player will ever meet missing
  const posts: PlannedPost[] = []
  for (const anchor of plan.anchors) {
    const role = roleFor(anchor.kind, one.charter)
    if (!role) continue
    const index = counts.npcs++
    posts.push({ npcId: world.mintId('npc'), anchor, role, index, appearance: { base: bodyFor(rng), variant: rng.int(0, 8) } })
  }

  // who owns the loose stock in a place: whoever carries it, else whoever is behind its counter
  const behindTheCounter = posts.find((post) => post.anchor.kind === 'serve')?.npcId
  const standingAt = (anchorId: string): string | undefined => posts.find((post) => post.anchor.id === anchorId)?.npcId
  const pocket = (keeper ?? plan.anchors[0]!).id
  const keeperNpcId = standingAt(pocket) ?? behindTheCounter
  const things: PlannedThing[] = plan.keys.map((key, index) => ({
    thingId: `${interiorId}/key/${index}`,
    archetype: key.archetype,
    anchorId: pocket,
    index: counts.items++,
    value: priceOf(key.archetype, rng),
    itemId: key.itemId,
    ...(keeperNpcId ? { ownerNpcId: keeperNpcId } : {}),
    opens: key.opens,
    room: key.room,
    carried: keeper !== undefined,
  }))
  // something worth locking up goes behind the lock; the rest lies on the surfaces people use
  const behind = plan.anchors.filter((anchor) => plan.shut.includes(anchor.roomId))
  const surfaces = surfacesOf(plan.anchors)
  for (const [at, archetype] of itemsFor(one.charter, rng, surfaces.length).entries()) {
    const anchor = (at === 0 && behind[0]) || surfaces[at % Math.max(1, surfaces.length)]
    if (!anchor) break
    things.push({
      thingId: `${interiorId}/thing/${at}`,
      itemId: world.mintId('item'),
      archetype,
      anchorId: anchor.id,
      index: counts.items++,
      value: priceOf(archetype, rng),
      ...(behindTheCounter ? { ownerNpcId: behindTheCounter } : {}),
    })
  }

  return { interiorId, size, plan, posts, things }
}
