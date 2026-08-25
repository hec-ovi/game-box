import { z } from 'zod'

/**
 * A person's own life, written once by the generator and only ever printed or
 * hashed: what makes two people in the same room answer differently. Every
 * line is bounded because it is model output that rides in the file.
 */
const Line = (max: number) => z.string().min(1).max(max)

export const LifeSchema = z.object({
  /** Where they came from and what happened to them. */
  history: Line(600).optional(),
  /** What they like to talk about. */
  interests: Line(300).optional(),
  /** How they speak. */
  manner: Line(300).optional(),
  /** What they care about. */
  cares: Line(300).optional(),
  /** What they will not talk about. */
  avoids: Line(300).optional(),
  /** Why they are at this spot at this hour. */
  reason: Line(300).optional(),
  /** What a walker is doing, or where they are going. */
  errand: Line(300).optional(),
})

/** What earns a player one fact about a person. */
export const BACKGROUND_UNLOCKS = ['met', 'talked', 'quest', 'told'] as const

/** The most staged facts one person carries. */
export const MAX_BACKGROUND_FACTS = 12

export const BackgroundFactSchema = z.object({
  fact: Line(300),
  /** Met them, talked to them, finished their quest, or was told by somebody else. */
  unlockedBy: z.enum(BACKGROUND_UNLOCKS),
})

export const BackgroundSchema = z.array(BackgroundFactSchema).max(MAX_BACKGROUND_FACTS)

export type Life = z.infer<typeof LifeSchema>
export type BackgroundUnlock = (typeof BACKGROUND_UNLOCKS)[number]
export type BackgroundFact = z.infer<typeof BackgroundFactSchema>
