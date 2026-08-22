import { z } from 'zod'

/**
 * Every id in the world is minted by `@gb/kit` as `kind_0001`, so a quest can
 * only ever name that shape. Written once here because the quest document and
 * the game events both police it.
 */
export const id = (kind: string) => z.string().regex(new RegExp(`^${kind}_\\d{4,}$`), `expected a ${kind} id`)
