import type { Item, ItemArchetype, Npc, World } from '@gb/world'
import type { Instance, ItemProfile } from '../narrator.ts'
import { bulkOf } from '../populate.ts'
import type { PlannedInside, PlannedSite, PlannedThing } from './planned.ts'

/** What a pass ended up writing on the town: the name every person and every thing came out with. */
export interface Wrote {
  /** By npc id. */
  readonly people: ReadonlyMap<string, string>
  /** By item id. */
  readonly things: ReadonlyMap<string, string>
}

/** What every place this pass puts up is called, and where each home is, so a deed can name it. */
export class PlaceNames {
  readonly #of = new Map<number, string>()
  readonly #homes = new Map<string, PlannedSite>()

  constructor(planned: readonly PlannedSite[], nameOf: (one: PlannedSite) => string) {
    for (const one of planned) {
      // a building already standing keeps the sign over its door: the street reads as it always did
      this.#of.set(one.index, one.standing ? one.standing.name : nameOf(one))
      if (one.inside) this.#homes.set(one.inside.interiorId, one)
    }
  }

  of(one: PlannedSite): string {
    return this.#of.get(one.index) ?? ''
  }

  /** The place an interior belongs to, by its id. */
  home(interiorId: string): PlannedSite | undefined {
    return this.#homes.get(interiorId)
  }
}

/**
 * Puts the buildings up and stops there: a plot for every site, and nothing
 * behind any door.
 *
 * This is the architecture, and it goes up before the town's work is written,
 * because a quest can only point at a plot that exists. Under a build it goes
 * up under placeholder names, which the naming pass writes over once the work
 * says what happens where. A building already standing is never put up again.
 */
export function raiseShell(world: World, planned: readonly PlannedSite[], names: PlaceNames): ReadonlyMap<number, string> {
  const plots = new Map<number, string>()
  for (const one of planned) {
    if (one.standing) {
      plots.set(one.index, one.standing.plotId)
      continue
    }
    const plot = world.addPlot({
      kind: one.charter.word,
      name: names.of(one),
      rect: one.site.rect,
      entrance: { cell: one.site.entrance, facing: one.site.facing },
      ...(one.district ? { district: one.district } : {}),
      storeys: one.storeys,
      style: one.style,
    })
    if (plot.ok) plots.set(one.index, plot.value.id)
  }
  return plots
}

/**
 * Writes what is behind the doors: the interiors, the people on their posts and
 * the things on their surfaces.
 *
 * Nothing here depends on when an answer arrived. The answers came back one per
 * request in request order, so the nth open building takes the nth answer;
 * inside an answer a person is matched to a post by `postId` and a name to a
 * thing by `thingId`, never by position. Every id was minted in the plan, so a
 * person and a thing are numbered the same however many calls were in the air.
 */
export function dress(world: World, planned: readonly PlannedSite[], plots: ReadonlyMap<number, string>, names: PlaceNames, written: readonly Instance[]): Wrote {
  const people = new Map<string, string>()
  const things = new Map<string, string>()
  let answer = 0

  for (const one of planned) {
    if (!one.inside) continue
    // the nth open building takes the nth answer, whether or not its plot went up
    const instance = written[answer++]
    const plotId = plots.get(one.index)
    if (!plotId) continue

    const { interiorId, size, plan, forSale } = one.inside
    world.addInterior({
      id: interiorId,
      plotId,
      kind: one.charter.word,
      // what the writer said this place is; a narrator that wrote none leaves the field off
      ...(instance?.character ? { description: instance.character } : {}),
      finish: one.charter.finish,
      size,
      ...plan,
      ...(forSale !== undefined ? { forSale } : {}),
    })
    fill(world, one, plotId, instance, names, { people, things })
  }
  return { people, things }
}

/**
 * A whole pass written into the world at once: the buildings up and everything
 * behind their doors. This is how a growth lands, because a growth has its
 * names before it has its plots.
 */
export function assemble(world: World, planned: readonly PlannedSite[], written: readonly Instance[]): string[] {
  const names = new PlaceNames(planned, (one) => one.sign)
  const plots = raiseShell(world, planned, names)
  dress(world, planned, plots, names, written)
  return planned.filter((one) => !one.standing && plots.has(one.index)).map((one) => plots.get(one.index)!)
}

/** Puts the written people on their posts, the written names on their things, and the keys and deeds where the plan put them. */
function fill(world: World, one: PlannedSite, plotId: string, instance: Instance | undefined, names: PlaceNames, wrote: { people: Map<string, string>; things: Map<string, string> }): void {
  const inside = one.inside as PlannedInside
  const cast = new Map((instance?.people ?? []).map((person) => [person.postId, person]))
  const standing = new Set<string>()

  for (const post of inside.posts) {
    const person = cast.get(post.anchor.id)
    if (!person) continue
    const npc: Npc = {
      id: post.npcId,
      name: person.name,
      // which post is which job is a fact about the building, never something a narrator decides
      role: post.role,
      appearance: post.appearance,
      station: { interiorId: inside.interiorId, anchorId: post.anchor.id },
      workPlotId: plotId,
      ...(one.charter.residential ? { homePlotId: plotId } : {}),
      personality: person.personality,
      knowledge: [...person.knowledge],
      ...(person.life ? { life: { ...person.life } } : {}),
      ...(person.background?.length ? { background: person.background.map((fact) => ({ ...fact })) } : {}),
    }
    if (!world.addNpc(npc).ok) continue
    wrote.people.set(npc.id, npc.name)
    standing.add(npc.id)
  }
  // whose home it is: the first person living in it, unless it is on the market
  const resident = standing.values().next().value
  if (one.charter.residential && inside.forSale === undefined && resident) world.recordOwner(inside.interiorId, resident)

  const named = new Map((instance?.things ?? []).map((thing) => [thing.thingId, thing]))
  for (const thing of inside.things) {
    const profile = named.get(thing.thingId) ?? aboutOf(thing, names.of(one), names)
    if (!profile) continue
    // the plan settled whose it is; whoever was never written into their post owns nothing
    const owner = thing.ownerNpcId && standing.has(thing.ownerNpcId) ? thing.ownerNpcId : undefined
    const carrier = thing.carried ? owner : undefined
    const item: Item = {
      id: thing.itemId,
      name: profile.name,
      description: profile.description,
      archetype: thing.archetype,
      value: thing.value,
      bulk: bulkOf(thing.archetype),
      ...(owner ? { ownerNpcId: owner } : {}),
      ...(thing.opens ? { opens: thing.opens } : {}),
      ...(thing.deedTo ? { deedTo: thing.deedTo } : {}),
    }
    if (!world.addItem(item, carrier ? { at: 'npc', itemId: item.id, npcId: carrier } : { at: 'anchor', itemId: item.id, interiorId: inside.interiorId, anchorId: thing.anchorId }).ok) continue
    wrote.things.set(item.id, item.name)
  }
}

/** A key, a card or a deed, named off what it opens or owns; nothing for a thing the narrator names. */
function aboutOf(thing: PlannedThing, placeName: string, names: PlaceNames): ItemProfile | undefined {
  if (thing.deedTo) {
    const home = names.home(thing.deedTo)
    const homeName = home ? names.of(home) : 'a place in town'
    return { name: `Deed to ${homeName}`, description: `Ownership of ${homeName}${home?.street ? ` on ${home.street}` : ''}. Whoever holds it lives there.` }
  }
  if (!thing.opens) return undefined
  const what = keyWord(thing.archetype)
  if ('interiorId' in thing.opens) return { name: `${placeName} ${what}`, description: `Opens the street door of ${placeName}.` }
  return { name: `${thing.room ?? 'Door'} ${what}`, description: `Opens the ${(thing.room ?? 'door').toLowerCase()} door at ${placeName}.` }
}

const keyWord = (archetype: ItemArchetype): string => (archetype === 'keycard' ? 'card' : 'key')
