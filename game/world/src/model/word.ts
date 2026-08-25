import { z } from 'zod'

/**
 * The one fiction in a world file: the word a premise invented for a kind of
 * place. `plot.kind` holds it, `world.charters` declares it, and nothing
 * branches on it; it is only printed, hashed and looked up.
 */
export const WORD = /^[a-z][a-z0-9-]{0,23}$/

export const WordSchema = z.string().regex(WORD, 'a word: lowercase letters, digits and hyphens, 24 at most')

export type Word = z.infer<typeof WordSchema>
