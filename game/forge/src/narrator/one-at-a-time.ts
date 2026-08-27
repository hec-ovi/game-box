import { err, ok } from '@gb/kit'
import type { Instance, InstancePerson, InstanceRequest, InstanceThing, Narrator, Written } from '../narrator.ts'

/** The two single-place questions a place written whole is made out of. */
type Singular = Pick<Narrator, 'describeNpc' | 'describeItem'>

/**
 * A place written whole out of the two single-place calls: one per post and one
 * per thing. It is what an offline narrator does, and it is what a narrator
 * with no plural of its own gets asked instead, so the city comes out the same
 * either way and only the number of round trips changes.
 *
 * The place is already named: the naming pass settled that before anybody was
 * written into it, and the name comes in on the request.
 *
 * Every place is asked about at once, and inside a place every post and every
 * thing at once, so a narrator backed by a model has the whole town in the air
 * rather than one question at a time. The answers are reassembled by index:
 * the nth request's answer goes in the nth slot, the nth post's person in the
 * nth slot of that, whatever order they landed in, so the city is the same
 * city whatever the narrator's concurrency was.
 */
export async function writeEachPlace(narrator: Singular, requests: readonly InstanceRequest[]): Promise<Written<readonly Instance[]>> {
  const written = await Promise.all(requests.map((request) => writePlace(narrator, request)))
  // one place nobody could write is a town with a room the work points into and
  // nobody in it, so the first failure stops the stage rather than thinning the city
  const stopped = written.find((one) => !one.ok)
  if (stopped && !stopped.ok) return err(stopped.error)
  return ok(written.map((one) => (one.ok ? one.value : undefined)).filter((one): one is Instance => one !== undefined))
}

async function writePlace(narrator: Singular, request: InstanceRequest): Promise<Written<Instance>> {
  const { kind, charter, theme, name } = request
  const story = request.premise ? { premise: request.premise } : {}
  const [people, things] = await Promise.all([
    Promise.all(
      request.posts.map(async (post): Promise<Written<InstancePerson>> => {
        // whoever the town's work already needs at this post, so a person asked
        // for one at a time is written to the same job as one asked for in a batch
        const cast = request.cast.filter((one) => one.postId === post.postId)
        const profile = await narrator.describeNpc({
          role: post.role,
          placeKind: kind,
          place: charter,
          placeName: name,
          theme,
          index: post.index,
          ...story,
          ...(cast.length ? { cast } : {}),
        })
        return profile.ok ? ok({ postId: post.postId, role: post.role, ...profile.value }) : profile
      }),
    ),
    Promise.all(
      request.things.map(async (stock): Promise<Written<InstanceThing>> => {
        const profile = await narrator.describeItem({ archetype: stock.archetype, theme, index: stock.index })
        return profile.ok ? ok({ thingId: stock.thingId, ...profile.value }) : profile
      }),
    ),
  ])
  const stopped = [...people, ...things].find((one) => !one.ok)
  if (stopped && !stopped.ok) return err(stopped.error)
  return ok({
    name,
    character: '',
    people: people.flatMap((one) => (one.ok ? [one.value] : [])),
    things: things.flatMap((one) => (one.ok ? [one.value] : [])),
  })
}
