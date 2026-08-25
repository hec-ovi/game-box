import { contract } from '@gb/kit'
import { z } from 'zod'
import { id } from './ids.ts'

/**
 * What a key or a card opens, and what a quest may grant: one door, or the
 * street door of one interior. Ids only, so the thing granted is always
 * something the file holds.
 */
export const AccessSchema = z.union([z.object({ doorId: id('door') }), z.object({ interiorId: id('interior') })])

export const accessContract = contract('access', AccessSchema)

/** Who an interior belongs to: the player, or one of the city's people. */
export const PLAYER = 'player'

export const OwnerSchema = z.union([z.literal(PLAYER), id('npc')])

export type Access = z.infer<typeof AccessSchema>
export type Owner = z.infer<typeof OwnerSchema>
