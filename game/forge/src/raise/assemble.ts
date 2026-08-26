import type { Item, ItemArchetype, Npc, World } from '@gb/world'
import type { Instance, ItemProfile } from '../narrator.ts'
import { bulkOf } from '../populate.ts'
import type { PlannedInside, PlannedSite, PlannedThing } from './planned.ts'

/**
 * Writes a planned town into the world, in the order it was planned.
 *
 * Nothing here depends on when an answer arrived. The answers came back one per
 * request in request order, so the nth open building takes the nth answer;
 * inside an answer a person is matched to a post by `postId` and a name to a
 * thing by `thingId`, never by position. Ids are minted here and nowhere else
 * but the plan, so a plot, an interior, a person and a thing are numbered in
 * the same order however many calls were in the air at once.
 *
 * A building already standing is never put up again: its plot is the one it
 * always was, and all that is written is the interior behind its door.
 */
export function assemble(world: World, planned: readonly PlannedSite[], written: readonly Instance[]): string[] {
  const added: string[] = []
  const names = new Names(planned, written)

  for (const one of planned) {
    const instance = names.answer(one)
    const plotId = one.standing ? one.standing.plotId : put(world, one, names)
    if (!plotId) continue
    if (!one.standing) added.push(plotId)
    if (!one.inside) continue

    const { interiorId, size, plan, forSale } = one.inside
    world.addInterior({ id: interiorId, plotId, kind: one.charter.word, finish: one.charter.finish, size, ...plan, ...(forSale !== undefined ? { forSale } : {}) })
    fill(world, one, plotId, instance, names)
  }
  return added
}

/** A building put up on land nothing had claimed. */
function put(world: World, one: PlannedSite, names: Names): string | undefined {
  const plot = world.addPlot({
    kind: one.charter.word,
    name: names.of(one),
    rect: one.site.rect,
    entrance: { cell: one.site.entrance, facing: one.site.facing },
    ...(one.district ? { district: one.district } : {}),
    storeys: one.storeys,
    style: one.style,
  })
  return plot.ok ? plot.value.id : undefined
}

/** What every place is called, settled before anything is written, because a deed names a home wherever the home is in the order. */
class Names {
  readonly #answers = new Map<PlannedSite, Instance>()
  readonly #homes = new Map<string, PlannedSite>()

  constructor(planned: readonly PlannedSite[], written: readonly Instance[]) {
    let answer = 0
    for (const one of planned) {
      if (!one.inside) continue
      const instance = written[answer++]
      if (instance) this.#answers.set(one, instance)
      this.#homes.set(one.inside.interiorId, one)
    }
  }

  answer(one: PlannedSite): Instance | undefined {
    return this.#answers.get(one)
  }

  /** What it is called: what the writer named it, unless the sign was already over the door. */
  of(one: PlannedSite): string {
    return one.standing ? one.standing.name : this.#answers.get(one)?.name || one.sign
  }

  /** The place an interior belongs to, by its id. */
  home(interiorId: string): PlannedSite | undefined {
    return this.#homes.get(interiorId)
  }
}

/** Puts the written people on their posts, the written names on their things, and the keys and deeds where the plan put them. */
function fill(world: World, one: PlannedSite, plotId: string, instance: Instance | undefined, names: Names): void {
  const inside = one.inside!
  const people = new Map((instance?.people ?? []).map((person) => [person.postId, person]))
  const standing = new Map<string, string>()
  let staff: string | undefined

  for (const post of inside.posts) {
    const person = people.get(post.anchor.id)
    if (!person) continue
    const npc: Npc = {
      id: world.mintId('npc'),
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
    standing.set(post.anchor.id, npc.id)
    if (post.anchor.kind === 'serve') staff ??= npc.id
  }
  // whose home it is: the first person living in it, unless it is on the market
  const resident = standing.values().next().value
  if (one.charter.residential && inside.forSale === undefined && resident) world.recordOwner(inside.interiorId, resident)

  const named = new Map((instance?.things ?? []).map((thing) => [thing.thingId, thing]))
  for (const thing of inside.things) {
    const profile = named.get(thing.thingId) ?? aboutOf(thing, names.of(one), names)
    if (!profile) continue
    const carrier = thing.carried ? standing.get(thing.anchorId) : undefined
    const owner = carrier ?? staff
    const item: Item = {
      id: thing.itemId ?? world.mintId('item'),
      name: profile.name,
      description: profile.description,
      archetype: thing.archetype,
      value: thing.value,
      bulk: bulkOf(thing.archetype),
      ...(owner ? { ownerNpcId: owner } : {}),
      ...(thing.opens ? { opens: thing.opens } : {}),
      ...(thing.deedTo ? { deedTo: thing.deedTo } : {}),
    }
    world.addItem(
      item,
      carrier ? { at: 'npc', itemId: item.id, npcId: carrier } : { at: 'anchor', itemId: item.id, interiorId: inside.interiorId, anchorId: thing.anchorId },
    )
  }
}

/** A key, a card or a deed, named off what it opens or owns; nothing for a thing the narrator names. */
function aboutOf(thing: PlannedThing, placeName: string, names: Names): ItemProfile | undefined {
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
