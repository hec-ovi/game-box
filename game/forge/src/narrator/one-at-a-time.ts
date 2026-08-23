import type { Instance, InstancePerson, InstanceRequest, InstanceThing, Narrator } from '../narrator.ts'

/** The three single-place questions a place written whole is made out of. */
type Singular = Pick<Narrator, 'namePlace' | 'describeNpc' | 'describeItem'>

/**
 * A place written whole out of the three single-place calls: its sign, then one
 * call per post and one per thing. It is what an offline narrator does, and it
 * is what a narrator with no plural of its own gets asked instead, so the city
 * comes out the same either way and only the number of round trips changes.
 */
export async function writeEachPlace(narrator: Singular, requests: readonly InstanceRequest[]): Promise<Instance[]> {
  const written: Instance[] = []
  for (const request of requests) {
    const { kind, theme } = request
    const name = await narrator.namePlace({ kind, theme, index: request.index })
    const people: InstancePerson[] = []
    for (const post of request.posts) {
      const profile = await narrator.describeNpc({ role: post.role, placeKind: kind, placeName: name, theme, index: post.index })
      people.push({ postId: post.postId, role: post.role, ...profile })
    }
    const things: InstanceThing[] = []
    for (const stock of request.things) {
      const profile = await narrator.describeItem({ archetype: stock.archetype, theme, index: stock.index })
      things.push({ thingId: stock.thingId, ...profile })
    }
    written.push({ name, character: '', people, things })
  }
  return written
}
