import { z } from 'zod'

/** A grid cell, by its column and row. */
export const CellSchema = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) })

/** A block of grid cells: where it starts, and how many cells it runs each way. */
export const RectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
})

/** A place in metres, from whatever origin the record it sits on measures from. */
export const PointSchema = z.object({ x: z.number(), y: z.number() })
