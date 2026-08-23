/**
 * The settings that decide which of the many possible answers a request gets.
 * They live in one place because the API layer, the engine layer and the
 * upstream body all have to agree on them.
 */
import { z } from 'zod'

/** llama.cpp reads the seed as a 32-bit value and keeps the top one for itself. */
const RANDOM_SEED = 4_294_967_295

const TEMPERATURE_DESCRIPTION =
  'How far the engine strays from its most likely token. 0 makes it take the most likely one every time.'
const SEED_DESCRIPTION =
  'Pins the random draw. Without a seed the engine picks a fresh one per request, so the same question comes back different.'

/** Mixed into a request schema so every layer accepts the same fields. */
export const samplingFields = {
  temperature: z.number().min(0).max(2).meta({ description: TEMPERATURE_DESCRIPTION }).optional(),
  seed: z
    .int()
    .min(0)
    .max(RANDOM_SEED - 1)
    .meta({ description: SEED_DESCRIPTION })
    .optional(),
}

export type Sampling = { readonly [K in keyof typeof samplingFields]?: number | undefined }

/** Just the settings the caller actually set, ready to spread into a request. */
export function samplingOf(source: Sampling): Sampling {
  const out: { -readonly [K in keyof Sampling]: number } = {}
  for (const key of Object.keys(samplingFields) as Array<keyof Sampling>) {
    const value = source[key]
    if (value !== undefined) out[key] = value
  }
  return out
}
