import { AccessSchema, CAR_MODELS } from '@gb/world'
import { z } from 'zod'
import { id } from './ids.ts'

/**
 * What finishing a quest hands over. Money, standing and things land on the
 * player; so do access and a car, through `@gb/play`. A deed is the one reward
 * that lands on the city instead, because whose a place is lives in the world
 * file: `quest-complete` carries it and the game writes the owner. The ids and
 * the closed lists are `@gb/world`'s; whether the amounts fit the work is
 * `balance.ts`.
 */
export const RewardSchema = z.object({
  money: z.number().int().min(0).max(100000).default(0),
  reputation: z.number().int().min(-50).max(50).default(0),
  faction: z.string().min(1).max(40).default('town'),
  items: z.array(id('item')).max(6).default([]),
  /** Doors or whole places the player may walk into from now on: what a keycard opens, without the card. */
  access: z.array(AccessSchema).max(4).optional(),
  /** A car the player keeps, one of the seven the city ships. */
  car: z.enum(CAR_MODELS).optional(),
  /** A home: the interior the player owns once the quest is done. */
  deed: id('interior').optional(),
})

export type Reward = z.infer<typeof RewardSchema>
export type { Access, CarModel } from '@gb/world'
