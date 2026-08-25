import { BALCONY } from '../src/balcony.ts'
import { PROUD } from '../src/fit.ts'
import type { Bucket } from '../src/bucket.ts'

/**
 * Whether a point stands where a model is allowed to: inside the plot plus a
 * tube's relief, or, on the street face above the ground storey, out to where
 * a balcony may hang over the pavement. The intake gate and the read-back
 * check both ask this, so what ships is held to the same line the producer's
 * output was.
 */
export function pastThePlot(x: number, y: number, z: number, bucket: Bucket, slack: number): boolean {
  if (Math.abs(x) > bucket.front / 2 + PROUD + slack) return true
  if (Math.abs(z) <= bucket.depth / 2 + PROUD + slack) return false
  const balcony = z > 0 && y >= BALCONY.above - slack && z <= bucket.depth / 2 + BALCONY.reach + slack
  return !balcony
}
