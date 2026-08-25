import type { Instance, InstancePerson, InstanceRequest, InstanceThing, Narrator } from '../narrator.ts'

/** The three single-place questions a place written whole is made out of. */
type Singular = Pick<Narrator, 'namePlace' | 'describeNpc' | 'describeItem'>

/**
 * A place written whole out of the three single-place calls: its sign, then one
 * call per post and one per thing. It is what an offline narrator does, and it
 * is what a narrator with no plural of its own gets asked instead, so the city
 * comes out the same either way and only the number of round trips changes.
 *
 * Every place is asked about at once, and inside a place every post and every
 * thing at once, so a narrator backed by a model has the whole town in the air
 * rather than one question at a time. The answers are reassembled by index:
 * the nth request's answer goes in the nth slot, the nth post's person in the
 * nth slot of that, whatever order they landed in, so the city is the same
 * city whatever the narrator's concurrency was.
 */
export async function writeEachPlace(narrator: Singular, requests: readonly InstanceRequest[]): Promise<Instance[]> {
  return Promise.all(requests.map((request) => writePlace(narrator, request)))
}

async function writePlace(narrator: Singular, request: InstanceRequest): Promise<Instance> {
  const { kind, charter, theme } = request
  const story = request.premise ? { premise: request.premise } : {}
  const name = await narrator.namePlace({ kind, charter, theme, index: request.index, ...story })
  const [people, things] = await Promise.all([
    Promise.all(
      request.posts.map(async (post): Promise<InstancePerson> => {
        const profile = await narrator.describeNpc({ role: post.role, placeKind: kind, place: charter, placeName: name, theme, index: post.index, ...story })
        return { postId: post.postId, role: post.role, ...profile }
      }),
    ),
    Promise.all(
      request.things.map(async (stock): Promise<InstanceThing> => {
        const profile = await narrator.describeItem({ archetype: stock.archetype, theme, index: stock.index })
        return { thingId: stock.thingId, ...profile }
      }),
    ),
  ])
  return { name, character: '', people, things }
}
