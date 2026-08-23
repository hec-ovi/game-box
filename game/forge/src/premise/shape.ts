import { contract } from '@gb/kit'
import { BUILDING_KINDS } from '@gb/world'
import { z } from 'zod'

/**
 * What the city is about, written before a street is laid.
 *
 * It is the first stage of the pipeline: why the town is here, what happened to
 * it, who is arguing about it and what the town therefore holds. Everything
 * after it reads it. It is deliberately short, because every later prompt
 * carries the whole of it, and deliberately concrete, because a premise nothing
 * downstream can act on costs a call and changes no city.
 */
export const PremiseSchema = z.object({
  /** Why the town is here and what it lives off. */
  livesOn: z.string().min(1),
  /** What happened, recent enough that people still talk about it. */
  happened: z.string().min(1),
  /** What is at stake, which is what the main line is about. */
  stake: z.string().min(1),
  /**
   * Who is arguing about it. Two at least, because a town's argument has two
   * ends; the first two are the ones the main line forks between.
   */
  sides: z
    .array(
      z.object({
        /** What people here call them. */
        name: z.string().min(1),
        /** What they want out of what is at stake. */
        wants: z.string().min(1),
      }),
    )
    .min(2),
  /** What everybody in town knows, whatever else they know. */
  common: z.array(z.string().min(1)),
  /** What the town therefore has, in `@gb/world`'s own building kinds. */
  build: z.object({
    /** Kinds the story means there are more of. */
    moreOf: z.array(z.enum(BUILDING_KINDS)),
    /** Kinds it means there are fewer of. */
    fewerOf: z.array(z.enum(BUILDING_KINDS)),
    /** Kinds the town has to contain whatever the mix rolls, and whose doors open first. */
    mustHave: z.array(z.enum(BUILDING_KINDS)),
  }),
})

export const premiseContract = contract('premise', PremiseSchema)

export type Premise = z.infer<typeof PremiseSchema>
export type PremiseSide = Premise['sides'][number]
export type PremiseBuild = Premise['build']

/**
 * A premise as written by a narrator, checked. Nothing a narrator writes is
 * trusted: one that does not hold up is dropped and the town is built without
 * one, the same way an unusable quest is dropped rather than shipped.
 */
export function premiseOf(written: unknown): Premise | undefined {
  if (written === undefined) return undefined
  const parsed = premiseContract.parse(written)
  return parsed.ok ? parsed.value : undefined
}
