import { contract } from '@gb/kit'
import { z } from 'zod'
import { MAX_CHARTERS } from './resolved.ts'
import { WordSchema } from './word.ts'

/**
 * Why the town is here and what it is arguing about. It is written once, before
 * anything is placed, and everything after it is built against it: the mix of
 * buildings, which doors open, what the main line is about, and what the people
 * standing in the places know.
 *
 * It lives here because it is a fact about the city, so a file somebody is sent
 * carries its own history. Every bound is a world document's bound, and `build`
 * names kinds of place by their word, the same word a charter declares.
 */
const Sentence = z.string().min(1).max(400)
const KindList = z.array(WordSchema).max(MAX_CHARTERS)

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
  /** What the town therefore holds, as words for kinds of place. */
  build: z.object({ moreOf: KindList, fewerOf: KindList, mustHave: KindList }),
})

export const premiseContract = contract('premise', PremiseSchema)

export type Premise = z.infer<typeof PremiseSchema>
