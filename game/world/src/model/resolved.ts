import { contract } from '@gb/kit'
import { z } from 'zod'
import { CharterSchema } from './charter.ts'
import { fraction, whole } from './numbers.ts'
import { KIT_PIECES } from './pieces.ts'
import { WORD } from './word.ts'

/**
 * A charter as the world file carries it: the charter plus what the engine
 * derived from it, written once so no reader re-derives anything. A piece id
 * comes from the kit's own list, never from a model, so a typo cannot draw a
 * wall with holes in it.
 */
const Piece = z.enum(KIT_PIECES)

/** One wall treatment: the plain module, the windowed one, and how often a window comes round. */
export const CourseSchema = z.object({
  plain: Piece,
  window: Piece,
  rhythm: z.union([z.literal(1), z.literal(2), z.literal(3)]),
})

export const BuiltSchema = z.object({
  /** Street level on the face the door is on. */
  street: CourseSchema,
  /** Street level on the other three faces. */
  flank: CourseSchema,
  /** Everything above the first floor. */
  upper: CourseSchema,
  /** Replaces `upper.plain` on the topmost band, when the wall has a crowning course. */
  crown: Piece.optional(),
  /** The metre-tall band that closes the ground floor. */
  fascia: Piece,
  door: Piece,
})

export const SignageSchema = z.object({
  /** Chance of a tall blade down the front. */
  blade: fraction(),
  /** Chance of a sign hanging out over the street. */
  hanging: fraction(),
  /** How many small lit accents the wall carries. */
  accents: whole(0, 4),
  /** How hard the nameplate over the door burns: 1 is neon, 0.25 a lit house number. */
  nameplate: fraction(),
})

export const ResolvedCharterSchema = CharterSchema.extend({
  built: BuiltSchema,
  signage: SignageSchema,
  /** The colour the building's mass is drawn in, packed `0xRRGGBB`. */
  tint: whole(0, 0xffffff),
  /** Tags the building catalogue matches a look against. */
  suits: z
    .array(z.string().regex(WORD))
    .min(1)
    .max(12)
    .overwrite((tags) => [...tags].sort())
    .refine((tags) => new Set(tags).size === tags.length, 'no tag twice'),
}).overwrite(sortKeys)

/** The most charters one city declares. */
export const MAX_CHARTERS = 24

/** Every kind of place a city has, sorted by word, no word twice. */
export const ChartersSchema = z
  .array(ResolvedCharterSchema)
  .min(1)
  .max(MAX_CHARTERS)
  .overwrite((charters) => [...charters].sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0)))
  .refine((charters) => new Set(charters.map((c) => c.word)).size === charters.length, 'no word twice')
  .readonly()

export const resolvedCharterContract = contract('resolved-charter', ResolvedCharterSchema)
export const chartersContract = contract('charters', ChartersSchema)

export type Course = z.infer<typeof CourseSchema>
export type Built = z.infer<typeof BuiltSchema>
export type Signage = z.infer<typeof SignageSchema>
export type ResolvedCharter = z.infer<typeof ResolvedCharterSchema>

/** The same record with every map's keys in order, so two writers produce one set of bytes. */
function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) out[key] = sortKeys((value as Record<string, unknown>)[key])
    return out as T
  }
  return value
}
