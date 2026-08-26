import { contract } from '@gb/kit'
import { z } from 'zod'
import { RectSchema } from './geometry.ts'
import { id } from './ids.ts'

/**
 * The most districts one city may be cut into. A district is what a player
 * says out loud instead of a bearing ("head west into Kiln Bay"), and a map
 * carrying more labels than a person holds in their head is a map of labels.
 * A city bigger than this gets bigger districts, never more of them.
 */
export const MAX_DISTRICTS = 12

/**
 * A named part of the city, and the unit between the city and a plot.
 *
 * It is a set of blocks rather than a box, so its shape is whatever the town
 * was cut into: an L, a Z, a T. The blocks are grid cells and their union is
 * the district, which is what a map draws and what a plot says it stands in.
 */
export const DistrictSchema = z.object({
  id: id('district'),
  /** What it is called: the name on a road sign, said out loud in conversation. */
  name: z.string().min(1).max(40),
  /** The blocks it holds, in grid cells. Their union is its shape. */
  blocks: z.array(RectSchema).min(1),
})

export const DistrictsSchema = z.array(DistrictSchema).max(MAX_DISTRICTS)

export const districtsContract = contract('districts', DistrictsSchema)

export type District = z.infer<typeof DistrictSchema>
