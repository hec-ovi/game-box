import { contract } from '@gb/kit'
import { z } from 'zod'
import { PLOT_BAND, TALLEST_STOREYS } from '../plot-band.ts'
import { whole } from './numbers.ts'
import {
  ACCESS_KINDS,
  FINISHES,
  FRONTAGES,
  HOLDINGS,
  MATERIALS,
  OPENNESS,
  PROMINENCES,
  ROOM_USES,
  SERVICES,
  SIGN_VOICES,
  SPRAWLS,
  TRANSITS,
  WORK_KINDS,
} from './traits.ts'
import { ROOM_KINDS } from './vocabulary.ts'
import { WordSchema } from './word.ts'

/**
 * What a kind of place is, as a generator writes it: the word the premise
 * invented, the text that is only ever printed, and the answers to the
 * questions the engine already asks (how it meets the street, whether there is
 * a post at the front, who may go past it, what people do in here, what it
 * keeps, how tall it is, which rooms it has). Every answer is a closed enum, a
 * clamped number or bounded text, so the engine never learns a fiction.
 */

/** The only interpolations a name template may hold: the town's three theme words. */
const NameTemplate = z
  .string()
  .min(1)
  .max(60)
  .regex(/^(?:[^{}]|\{(?:family|adjective|noun)\})+$/, 'a name template interpolates only {family}, {adjective} and {noun}')

/** A room the charter asks for: which routine dresses it and what it is called. */
const RoomSpec = z.object({
  use: z.enum(ROOM_USES),
  name: z.string().min(1).max(60),
  /** The label the room is cut as, when it is not the one its use implies: a bar's store is a cellar. */
  kind: z.enum(ROOM_KINDS).optional(),
})

const ServiceSpec = RoomSpec.extend({
  weight: whole(1, 3),
  /** Only when the building has room to spare. */
  spare: z.boolean().optional(),
  /** Behind a locked door, for a place that admits people only so far. */
  shut: z.boolean().optional(),
})

/** A subset of a trait list, at most `most` long, held in list order with no repeats. */
const subset = <const T extends readonly [string, ...string[]]>(values: T, most: number) =>
  z
    .array(z.enum(values))
    .max(most)
    .overwrite((picked) => [...picked].sort((a, b) => values.indexOf(a) - values.indexOf(b)))
    .refine((picked) => new Set(picked).size === picked.length, 'no value twice')

export const MOST_NAMES = 3
export const MOST_RUMOURS = 3
export const MOST_SERVICES = 5

export const CharterSchema = z.object({
  word: WordSchema,
  /** What a person says out loud. */
  label: z.string().regex(/^[a-z][a-z0-9 -]{0,23}$/, 'a lowercase noun of 24 characters at most'),
  /** The word spelled down the blade sign: the glyphs the sign atlas holds, short enough to read. */
  blade: z.string().regex(/^[A-Z0-9 ]{2,8}$/, 'capitals, digits and spaces, 2 to 8 of them'),
  names: z.array(NameTemplate).min(1).max(MOST_NAMES),
  /** What people say about a place of this kind. Empty falls through to what the whole town knows. */
  rumours: z.array(z.string().min(1).max(300)).max(MOST_RUMOURS),
  /** Its base weight in the mix of a town. */
  share: whole(1, 10),
  prominence: z.enum(PROMINENCES),
  /** Whether people live here. */
  residential: z.boolean(),
  size: z.object({
    storeys: z
      .tuple([whole(PLOT_BAND.storeys.min, TALLEST_STOREYS), whole(PLOT_BAND.storeys.min, TALLEST_STOREYS)])
      .refine(([low, high]) => low <= high, 'low storeys first'),
    sprawl: z.enum(SPRAWLS),
  }),
  street: z.object({
    frontage: z.enum(FRONTAGES),
    openness: z.enum(OPENNESS),
    material: z.enum(MATERIALS),
    voice: z.enum(SIGN_VOICES),
  }),
  access: z.enum(ACCESS_KINDS),
  /** Whether its entrance is a station fast travel boards at. Absent is none. */
  transit: z.enum(TRANSITS).optional(),
  service: z.enum(SERVICES),
  work: subset(WORK_KINDS, 3),
  holding: subset(HOLDINGS, 3),
  finish: z.enum(FINISHES),
  rooms: z.object({
    /** The room the street door opens into, when the building is deep enough for one. */
    hall: RoomSpec.optional(),
    main: RoomSpec,
    services: z.array(ServiceSpec).max(MOST_SERVICES),
  }),
})

export const charterContract = contract('charter', CharterSchema)

export type Charter = z.infer<typeof CharterSchema>
export type CharterRoom = z.infer<typeof RoomSpec>
export type CharterService = z.infer<typeof ServiceSpec>
