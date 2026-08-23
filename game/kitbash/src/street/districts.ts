import type { LampSpot } from './layout.ts'

/**
 * How wide a district is, in metres. A whole city in one mesh is one bounding
 * volume, so nothing in it can ever be culled; a district is small enough that
 * most of them fall outside the view down a street, and wide enough that a town
 * is a few dozen of them rather than a few hundred.
 */
export const DISTRICT = 48

/** One square of the city and everything standing in it. */
export interface District<T> {
  /** Row-major position of the square, so the same city chunks the same way every run. */
  readonly x: number
  readonly z: number
  readonly of: T[]
}

/**
 * Cuts the city into squares and drops each thing into the one it stands in.
 * Empty squares are left out, and the districts come back in row-major order,
 * which is what makes the chunking deterministic.
 */
export function districtsOf(spots: readonly LampSpot[], size = DISTRICT): Array<District<LampSpot>> {
  const found = new Map<string, District<LampSpot>>()
  for (const spot of spots) {
    const x = Math.floor(spot.x / size)
    const z = Math.floor(spot.z / size)
    const key = `${z},${x}`
    const district = found.get(key)
    if (district) district.of.push(spot)
    else found.set(key, { x, z, of: [spot] })
  }
  return [...found.values()].sort((a, b) => a.z - b.z || a.x - b.x)
}
