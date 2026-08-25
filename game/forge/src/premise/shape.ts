import { contract } from '@gb/kit'
import { CharterSchema, MAX_CHARTERS, PremiseSchema, type Charter, type Premise } from '@gb/world'
import { z } from 'zod'

/**
 * The history a narrator writes: `@gb/world`'s premise, and the kinds of place
 * it invented along the way. The premise is the world's own shape because the
 * file carries it; the charters ride beside it here and go into the file as
 * `world.charters` once they have been through the gate, so a history that
 * says "there is a jail" declares what a jail is in the same breath.
 */
export type History = Premise & { readonly charters?: readonly Charter[] }

export const HistorySchema = PremiseSchema.extend({ charters: z.array(CharterSchema).max(MAX_CHARTERS).optional() })

export const historyContract = contract('history', HistorySchema)
