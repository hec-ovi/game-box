import { z } from 'zod'

/**
 * The numbers a charter carries, normalised as they are read: clamped into
 * their range and, for a fraction, rounded to three decimals. A model that
 * writes 0.7000000001 or 14 storeys out of 40 cannot move a building by it,
 * and the published schema still states the range.
 */
const clamp = (low: number, high: number) => (value: number) => Math.min(high, Math.max(low, value))

/** A whole number held between `low` and `high`. */
export const whole = (low: number, high: number) => z.number().overwrite(clamp(low, high)).int().min(low).max(high)

/** A share between 0 and 1, to three decimals. */
export const fraction = () =>
  z
    .number()
    .overwrite(clamp(0, 1))
    .overwrite((value) => Math.round(value * 1000) / 1000)
    .min(0)
    .max(1)
