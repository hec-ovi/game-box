import { contract } from '@gb/kit'
import { z } from 'zod'

/**
 * A city's brief, as the model writes it for somebody sitting in front of the
 * form with an empty field.
 *
 * It is the same five things the form asks for, and nothing else: the answer
 * goes straight into the fields the owner is looking at, so anything the schema
 * carried that the form has no box for would be written and thrown away.
 *
 * Every field is described here rather than only in the prompt, because a
 * constrained decoder reads the schema and the prose separately and only the
 * schema is enforced.
 */
export const BriefDraftSchema = z.object({
  theme: z
    .string()
    .min(3)
    .max(60)
    .describe('The city in a handful of words, the way somebody would say it out loud: "rain-soaked cargo port", "high desert refinery town". Not a sentence.'),
  brief: z
    .string()
    .min(40)
    .describe('What this city is about: what it lives on, what went wrong here, who is arguing over it. A short paragraph of plain prose, in the owner\'s own voice rather than a pitch.'),
  mainQuest: z
    .string()
    .min(20)
    .describe('What the story asks the player to do, in one sentence. Name a thing to find, reach or settle. It must be something a person could walk to a place and do.'),
  sideQuests: z
    .string()
    .min(20)
    .describe('The kind of small work this town hands out, a sentence or two. Errands people here would actually pay for, not a numbered list.'),
  tone: z
    .string()
    .min(3)
    .max(80)
    .describe('How people here talk, as a few adjectives: "guarded, dry, tired". Not a sentence.'),
})

/** The five fields of a brief, as the model wrote them. */
export type BriefDraft = z.infer<typeof BriefDraftSchema>

/** Which of them the owner asked to have written. The rest come back the way they went in. */
export type BriefField = keyof BriefDraft

export const BRIEF_FIELDS: readonly BriefField[] = ['theme', 'brief', 'mainQuest', 'sideQuests', 'tone']

export const briefDraftContract = contract('brief-draft', BriefDraftSchema)

/** What the owner has typed so far. Any of it, or all of it, may be blank. */
export type BriefSoFar = Partial<Record<BriefField, string>>

/** How each field reads in the prompt when it is being asked for, and when it is only context. */
export const BRIEF_LABELS: Record<BriefField, string> = {
  theme: 'the theme',
  brief: 'what the city is about',
  mainQuest: 'the main story',
  sideQuests: 'the side jobs',
  tone: 'the tone people speak in',
}
