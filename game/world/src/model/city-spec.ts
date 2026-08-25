import { contract } from '@gb/kit'
import { z } from 'zod'
import { WorldSchema } from './schema.ts'

/**
 * What it takes to found a city. Every bound is the world document's own bound,
 * so a spec that passes here can only produce a world that loads and validates.
 */
export const CitySpecSchema = z.object({
  name: WorldSchema.shape.name,
  theme: WorldSchema.shape.theme,
  brief: WorldSchema.shape.brief,
  asks: WorldSchema.shape.asks,
  seed: WorldSchema.shape.seed,
  width: WorldSchema.shape.grid.shape.width,
  height: WorldSchema.shape.grid.shape.height,
  cellSize: WorldSchema.shape.cellSize.optional(),
  /** Which generator is about to fill it, so a regeneration can match it. */
  generator: WorldSchema.shape.generator.optional(),
  /** The history it is being built against, when somebody wrote one. */
  premise: WorldSchema.shape.premise,
  /** The kinds of place it will hold, when they are not the shipped presets. */
  charters: WorldSchema.shape.charters,
})

export const citySpecContract = contract('city-spec', CitySpecSchema)

export type CitySpec = Readonly<z.infer<typeof CitySpecSchema>>
