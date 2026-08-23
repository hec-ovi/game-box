import type { Item, Npc, World } from '@gb/world'
import type { Instance } from '../narrator.ts'
import { bulkOf } from '../populate.ts'
import type { PlannedInside, PlannedSite } from './planned.ts'

/**
 * Writes a planned town into the world, in the order it was planned.
 *
 * Nothing here depends on when an answer arrived. The answers came back one per
 * request in request order, so the nth open building takes the nth answer;
 * inside an answer a person is matched to a post by `postId` and a name to a
 * thing by `thingId`, never by position. Ids are minted here and nowhere else,
 * so a plot, an interior, a person and a thing are numbered in the same order
 * however many calls were in the air at once.
 */
export function assemble(world: World, planned: readonly PlannedSite[], written: readonly Instance[]): string[] {
  const added: string[] = []
  let answer = 0

  for (const one of planned) {
    const instance = one.inside ? written[answer++] : undefined
    const plot = world.addPlot({
      kind: one.kind,
      name: instance?.name || one.sign,
      rect: one.site.rect,
      entrance: { cell: one.site.entrance, facing: one.site.facing },
      storeys: one.storeys,
      style: one.style,
    })
    if (!plot.ok) continue
    added.push(plot.value.id)
    if (!one.inside) continue

    world.addInterior({ id: one.inside.interiorId, plotId: plot.value.id, kind: one.kind, size: one.inside.size, ...one.inside.plan })
    fill(world, one.inside, plot.value.id, instance)
  }
  return added
}

/** Puts the written people on their posts and the written names on their things. */
function fill(world: World, inside: PlannedInside, plotId: string, instance: Instance | undefined): void {
  const people = new Map((instance?.people ?? []).map((person) => [person.postId, person]))
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
      personality: person.personality,
      knowledge: [...person.knowledge],
    }
    if (world.addNpc(npc).ok && post.anchor.kind === 'serve') staff ??= npc.id
  }

  const named = new Map((instance?.things ?? []).map((thing) => [thing.thingId, thing]))
  for (const thing of inside.things) {
    const written = named.get(thing.thingId)
    if (!written) continue
    const item: Item = {
      id: world.mintId('item'),
      name: written.name,
      description: written.description,
      archetype: thing.archetype,
      value: thing.value,
      bulk: bulkOf(thing.archetype),
      ...(staff ? { ownerNpcId: staff } : {}),
    }
    world.addItem(item, { at: 'anchor', itemId: item.id, interiorId: inside.interiorId, anchorId: thing.anchorId })
  }
}
