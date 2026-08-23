import { contract } from '@gb/kit'
import { z } from 'zod'
import { BUILDING_KINDS } from './vocabulary.ts'

/**
 * Why the town is here and what it is arguing about. It is written once, before
 * anything is placed, and everything after it is built against it: the mix of
 * buildings, which doors open, what the main line is about, and what the people
 * standing in the places know.
 *
 * It lives here because it is a fact about the city, so a file somebody is sent
 * carries its own history. Every bound is a world document's bound, and `build`
 * is in this box's own `BUILDING_KINDS`, so a history that names a building the
 * game cannot put up is refused rather than half-applied.
 */
const Sentence = z.string().min(1).max(400)
const KindList = z.array(z.enum(BUILDING_KINDS)).max(BUILDING_KINDS.length)

export const PremiseSchema = z.object({
  /** What the town lives on. */
  livesOn: Sentence,
  /** What happened to it. */
  happened: Sentence,
  /** What is at stake now. */
  stake: Sentence,
  /** Who is arguing about it, and what each of them wants. Two at least. */
  sides: z
    .array(z.object({ name: z.string().min(1).max(60), wants: z.string().min(1).max(300) }))
    .min(2)
    .max(8),
  /** What everybody in town knows. */
  common: z.array(z.string().min(1).max(300)).max(20),
  /** What the town therefore holds, in building kinds. */
  build: z.object({ moreOf: KindList, fewerOf: KindList, mustHave: KindList }),
})

export const premiseContract = contract('premise', PremiseSchema)

export type Premise = z.infer<typeof PremiseSchema>
