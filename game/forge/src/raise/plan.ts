import type { Rng } from '@gb/kit'
import { METRICS, type Premise, type ResolvedCharter, type Word, type World } from '@gb/world'
import { PLACEHOLDER_CHARTER } from '../charters/placeholder.ts'
import { openDoors, type Frontage } from '../interior/open.ts'
import { planInterior } from '../interior/plan.ts'
import { nearnessIn } from '../layout/plots.ts'
import type { InstanceBrief, InstanceCasting, InstanceRequest, PlaceRequest, PlaceSign } from '../narrator.ts'
import { PLACEHOLDER_KIND } from '../naming/placeholders.ts'
import { premiseLines } from '../premise/render.ts'
import type { Signs } from '../narrator/signs.ts'
import type { StreetNames } from '../narrator/streets.ts'
import { bodyFor, itemsFor, keeperOf, roleFor, surfacesOf } from '../populate.ts'
import { callsForDancing } from '../premise/wants.ts'
import { priceOf } from '../prices.ts'
import { putUpForSale } from './homes.ts'
import { narrated, type Chosen, type PlannedInside, type PlannedPost, type PlannedSite, type PlannedThing, type Sited } from './planned.ts'

/** What the whole town needs before a single site can be planned. */
export interface RaiseSetup {
  readonly theme: string
  /** What the city is about, when a narrator wrote one. */
  readonly premise?: Premise
  /** How many places the city opens, whatever its size. */
  readonly places: number
  /** The kinds of place this city declares: what a written word is resolved against. */
  readonly kinds: readonly ResolvedCharter[]
  readonly signs: Signs
  /** What every street in the town is called. */
  readonly streets: StreetNames
  /** Which doors open, decided over the whole town at once. */
  readonly doors: Rng
  /** The stream every interior's people and things are drawn from. */
  readonly people: Rng
}

/** What the writing said about the buildings the architecture put up. */
export interface Decided {
  /** What each one is, by its place in the batch. A building nothing was written for keeps the architecture's placeholder. */
  readonly kinds: ReadonlyMap<number, ResolvedCharter>
  /** Which of them open, by their place in the batch. */
  readonly open: ReadonlySet<number>
}

/**
 * The buildings the architecture puts up: a number, a street and a footprint in
 * metres each, and nothing about what any of them is. This is what the writing
 * is shown when it is asked what a place is, and what the door ranking reads.
 */
export function siteBuildings(world: World, chosen: readonly Chosen[], setup: RaiseSetup): Sited[] {
  const first = world.plots().length
  return chosen.map((one, at): Sited => {
    const street = setup.streets.at(one.site.entrance, one.site.facing)
    const across = one.site.facing === 'north' || one.site.facing === 'south'
    return {
      ...one,
      // a facade that was already standing keeps its number: its people are drawn where they were
      index: one.standing?.index ?? first + at,
      ...(street ? { street } : {}),
      floor: {
        frontage: (across ? one.site.rect.w : one.site.rect.h) * world.cellSize,
        depth: (across ? one.site.rect.h : one.site.rect.w) * world.cellSize,
      },
    }
  })
}

/**
 * Which of a batch of buildings open, by their place in the batch.
 *
 * It runs on the architecture alone, because at this point nothing in the town
 * is anything: a door is picked for the floor behind it, where it stands and
 * how far it is from the doors already open. What each one turns out to be is
 * the next question, and what the town needs its doors to be goes out with it.
 */
export function openIn(world: World, sited: readonly Sited[], setup: RaiseSetup): ReadonlySet<number> {
  const open = openDoors(frontagesOf(world, sited), setup.doors, {
    built: world.plots().length,
    open: world.interiors().flatMap((interior) => {
      const plot = world.plot(interior.plotId)
      return plot ? [plot.entrance.cell] : []
    }),
    span: Math.max(world.grid.width, world.grid.height),
    places: setup.places,
  })
  return new Set([...open].map(Number))
}

/**
 * Decides everything about a town's buildings that is arithmetic: the shell of
 * each open one, who is standing in it and what is lying about. Nothing here
 * awaits anything, so the whole town is planned in one pass and the questions
 * about it can then all go out together.
 *
 * What each building is came from the writing. One nothing was written for
 * stands under the architecture's own placeholder, which is what a plan shows
 * and what a door nobody wrote a word about keeps.
 */
export function planRaise(world: World, sited: readonly Sited[], setup: RaiseSetup, decided: Decided): PlannedSite[] {
  const counts = { npcs: world.npcs().length, items: world.items().length }
  const story = setup.premise ? premiseLines(setup.premise) : undefined

  const planned = sited.map((one, at): PlannedSite => {
    const charter = decided.kinds.get(at) ?? PLACEHOLDER_CHARTER
    return {
      ...one,
      charter,
      style: styleOf(setup.theme, charter.word),
      // a facade that was already standing keeps its sign: the street reads as it always did
      sign: one.standing?.name ?? setup.signs.over(charter, setup.theme, one.index, { premise: story, street: one.street }),
      ...(decided.open.has(at) ? { inside: planInside(world, one, charter, setup, counts) } : {}),
    }
  })
  // a home for the player is a fact about the whole town, so it is picked once the town is planned
  return putUpForSale(planned, counts, () => world.mintId('item'), setup.people.fork('sale'))
}

/**
 * One building as every narrator is shown it: where it stands, how big it is,
 * the town's story, and what it is once that has been settled.
 */
function placeRequest(one: Sited, charter: ResolvedCharter | undefined, setup: RaiseSetup, premise: string | undefined): PlaceRequest {
  const written = charter && charter.word !== PLACEHOLDER_KIND
  return {
    ...(written ? { kind: charter.word, charter } : {}),
    theme: setup.theme,
    index: one.index,
    storeys: one.storeys,
    floor: one.floor,
    onAvenue: one.onAvenue,
    ...(one.street ? { street: one.street } : {}),
    ...(premise ? { premise } : {}),
  }
}

/** Nothing the work asks of a place, which is what most places get asked. */
const nothing = (): readonly never[] => []

/**
 * The buildings whose doors open, as the writing is shown them before it says
 * what each one is: the architecture and nothing else.
 */
export function kindRequests(sited: readonly Sited[], open: ReadonlySet<number>, setup: RaiseSetup): PlaceRequest[] {
  const premise = setup.premise ? premiseLines(setup.premise) : undefined
  return sited.filter((_, at) => open.has(at)).map((one) => placeRequest(one, undefined, setup, premise))
}

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
      ...placeRequest(one, one.charter, setup, premise),
      kind: one.charter.word,
      charter: one.charter,
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
 * every sign in the town comes out of the same call. A door that never opens
 * carries no kind either, so this is where the rest of the town becomes
 * something. A building already standing keeps the sign it has and is not asked
 * about.
 */
export function nameRequests(planned: readonly PlannedSite[], setup: RaiseSetup, work: (one: PlannedSite) => readonly string[] = nothing): PlaceRequest[] {
  const premise = setup.premise ? premiseLines(setup.premise) : undefined
  return planned.filter(wantsName).map((one) => {
    const doing = work(one)
    return { ...placeRequest(one, one.charter, setup, premise), ...(doing.length ? { work: doing } : {}) }
  })
}

/**
 * What the naming pass wrote, put on the buildings: the nth door takes the nth
 * answer, and a door the writing left blank keeps what the box composed.
 *
 * A frontage that comes back a bakery is a bakery from here on, sign and all:
 * its sign is composed again off the kind it turned out to be, unless the same
 * answer wrote one. A word the city does not declare leaves the building a
 * building.
 */
export function hangSigns(planned: readonly PlannedSite[], written: readonly PlaceSign[], setup: RaiseSetup): PlannedSite[] {
  const story = setup.premise ? premiseLines(setup.premise) : undefined
  let answer = 0
  return planned.map((one) => {
    if (!wantsName(one)) return one
    const said = written[answer++]
    const charter = (one.charter.word === PLACEHOLDER_KIND ? kindOf(said?.kind, setup.kinds) : undefined) ?? one.charter
    const sign = said?.name?.trim() || (charter === one.charter ? one.sign : setup.signs.over(charter, setup.theme, one.index, { premise: story, street: one.street }))
    return { ...one, charter, sign, style: styleOf(setup.theme, charter.word) }
  })
}

/** What a building's look is filed under: the town's own word and the kind of place it turned out to be. */
const styleOf = (theme: string, word: Word): string => `${theme.split(/\s+/)[0]?.toLowerCase() ?? 'plain'}-${word}`

/** A door this pass put up, so its sign is this pass's to write. */
export const wantsName = (one: PlannedSite): boolean => one.standing === undefined

/**
 * The buildings as the door ranking sees them. They are keyed by where they
 * stand in the list rather than by a plot id, because no plot exists yet: the
 * order is the order they were chosen in, which is the order they are minted
 * in, so the ranking breaks its ties exactly where it always did.
 */
function frontagesOf(world: World, sited: readonly Sited[]): Frontage[] {
  return sited.map((one, at) => ({
    id: String(at),
    spot: one.site.entrance,
    floor: one.site.rect.w * one.site.rect.h,
    nearness: nearnessIn(world.grid, one.site.entrance),
    onAvenue: one.onAvenue,
  }))
}

/** Cuts the inside of one building and decides who is in it, without naming anybody. */
function planInside(world: World, one: Chosen, charter: ResolvedCharter, setup: RaiseSetup, counts: { npcs: number; items: number }): PlannedInside {
  const wall = METRICS.building.wallThickness
  const size = { w: one.site.rect.w * world.cellSize - wall * 2, h: one.site.rect.h * world.cellSize - wall * 2 }
  const interiorId = world.mintId('interior')
  const plan = planInterior({
    charter,
    size,
    entrance: one.site.facing,
    wants: { dancing: callsForDancing(setup.theme, setup.premise) },
    interiorId,
    mint: (kind) => world.mintId(kind),
    rng: one.rng.fork('inside'),
  })
  const rng = setup.people.fork(`people/${interiorId}`)
  // whoever keeps the keys: a lock without its keeper is a lock nobody can write a quest through
  const keeper = keeperOf(plan.anchors, charter)
  // a city opens a handful of places and its whole cast stands in them, so every
  // post in one is filled: an empty stool in a town of three doors is a third of
  // the people the player will ever meet missing
  const posts: PlannedPost[] = []
  for (const anchor of plan.anchors) {
    const role = roleFor(anchor.kind, charter)
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
  for (const [at, archetype] of itemsFor(charter, rng, surfaces.length).entries()) {
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

/** The word a written answer names, resolved against the kinds the city declares. */
export const kindOf = (word: Word | undefined, kinds: readonly ResolvedCharter[]): ResolvedCharter | undefined =>
  word === undefined || word === PLACEHOLDER_KIND ? undefined : kinds.find((one) => one.word === word)
