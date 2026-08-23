import { premiseContract, type Premise } from '@gb/world'

/**
 * The city's history is `@gb/world`'s shape, because it is a fact about the
 * city and a file somebody is sent carries it. This box writes one and builds
 * against it; what it is lives there.
 */

/** One side of the town's argument: who they are and what they want out of it. */
export type PremiseSide = Premise['sides'][number]

/** What the history says the town holds, in `@gb/world`'s own building kinds. */
export type PremiseBuild = Premise['build']

/**
 * A premise as written by a narrator, checked against the contract the world
 * document will hold it to. Nothing a narrator writes is trusted: one that does
 * not hold up is dropped here and the town is built without one, the same way
 * an unusable quest is dropped rather than shipped. Checking it against world's
 * own bounds is what keeps a long one out of `World.found`, where it would take
 * the whole city down instead.
 */
export function premiseOf(written: unknown): Premise | undefined {
  if (written === undefined) return undefined
  const parsed = premiseContract.parse(written)
  return parsed.ok ? parsed.value : undefined
}
