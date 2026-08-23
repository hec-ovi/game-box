import { contract } from '@gb/kit'
import { z } from 'zod'

/**
 * An art catalogue a city was designed against: the pack that was loaded, the
 * version of it, and the hash of that pack's own manifest where the producer
 * had one.
 */
export const AssetPackRefSchema = z.object({
  pack: z.string().min(1).max(60),
  version: z.string().min(1).max(20),
  /** Hash of the pack's own manifest, so a different pack of the same name is caught. */
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
})

/**
 * What one plot was actually dressed with, written down at the moment it was
 * chosen. A design is a fact about the file and is never re-derived: a reader
 * with a newer catalogue draws the model named here, or falls back, and never
 * picks a different one.
 */
export const PlotDesignSchema = z.object({
  /** The `pack` of one entry in the world's `catalogues`. */
  pack: z.string().min(1).max(60),
  /** Which building in that pack. */
  model: z.string().min(1).max(80),
  /** Whether it is drawn mirrored. */
  mirror: z.boolean(),
  /** Whole pictures to slide the rooms behind its windows along. */
  rooms: z.number().int().min(0),
})

/** At most this many catalogues in one city, matching what a bundle may name. */
export const MAX_CATALOGUES = 32

export const catalogueListContract = contract('catalogues', z.array(AssetPackRefSchema).max(MAX_CATALOGUES))
export const plotDesignContract = contract('plot-design', PlotDesignSchema)

export type AssetPackRef = z.infer<typeof AssetPackRefSchema>
export type PlotDesign = z.infer<typeof PlotDesignSchema>
