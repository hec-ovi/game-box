import { z } from 'zod'

/**
 * What the owner asked the city for, in their own words, kept in the file so
 * whoever opens it can see why the city is the way it is and a later growth
 * keeps to it. The prose is unbounded: it is the owner's, never the model's.
 *
 * `style` is the one ask the art can only partly honour, so it is a closed set
 * of choices inside the catalogue. A period or a look the catalogue does not
 * hold (medieval, pastel, brutalist) is not a value here on purpose: it would
 * give a cyberpunk town with medieval names, and a form has to say so rather
 * than take the word and drop it.
 */
const Words = z.string().min(1)

/** How much neon the street carries. */
export const NEON_LEVELS = ['dark', 'some', 'lit'] as const
/** How tightly the plots are packed. */
export const DENSITY_LEVELS = ['sparse', 'mixed', 'dense'] as const
/** How worn the place looks. */
export const WEAR_LEVELS = ['kept', 'lived-in', 'run-down'] as const

export const StyleSchema = z.object({
  neon: z.enum(NEON_LEVELS).optional(),
  density: z.enum(DENSITY_LEVELS).optional(),
  wear: z.enum(WEAR_LEVELS).optional(),
})

export const AsksSchema = z.object({
  /** What the main line should be about. */
  mainQuest: Words.optional(),
  /** What kind of side work the town offers. */
  sideQuests: Words.optional(),
  /** The tone of the whole thing. */
  tone: Words.optional(),
  style: StyleSchema.optional(),
})

/** The owner's own words on what the city is about. */
export const BriefSchema = Words

export type Style = z.infer<typeof StyleSchema>
export type Asks = z.infer<typeof AsksSchema>
export type NeonLevel = (typeof NEON_LEVELS)[number]
export type DensityLevel = (typeof DENSITY_LEVELS)[number]
export type WearLevel = (typeof WEAR_LEVELS)[number]
