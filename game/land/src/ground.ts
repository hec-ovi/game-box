import type { World } from '@gb/world'
import type { HeightField } from './height.ts'

/** One step of resolution: how big its quads are and how far out it reaches. */
export interface TierSpec {
  readonly step: number
  readonly reach: number
}

interface Tier {
  readonly step: number
  readonly xs: Float64Array
  readonly zs: Float64Array
  readonly heights: Float32Array
  /** Index range of the rectangle this tier leaves to the finer one inside it. */
  readonly hole: { i0: number; i1: number; j0: number; j1: number }
}

export interface Quad {
  readonly x0: number
  readonly z0: number
  readonly x1: number
  readonly z1: number
  readonly h00: number
  readonly h10: number
  readonly h11: number
  readonly h01: number
}

/**
 * The ground the player walks on, as squares that get bigger with distance.
 *
 * Near the town the lattice is fine enough to walk on; further out each step is
 * four times the last, so a landscape kilometres across costs a fraction of
 * what one resolution everywhere would. Heights are computed once and kept, and
 * `heightAt` reads back the very surface the mesh is built from, so a foot
 * placed on the answer stands exactly on the triangle you can see.
 */
export class Ground {
  readonly #tiers: readonly Tier[]
  readonly #field: HeightField
  readonly #town: { x1: number; z1: number }

  private constructor(tiers: readonly Tier[], field: HeightField, town: { x1: number; z1: number }) {
    this.#tiers = tiers
    this.#field = field
    this.#town = town
  }

  /**
   * Lay every tier out on lattices anchored at the world origin, so a coarse
   * line is always a fine line too and the tiers can be cut out of each other
   * exactly. The finest tier alone is nudged to land on the edge of the map.
   */
  static build(world: World, field: HeightField, specs: readonly TierSpec[]): Ground {
    const townX = world.grid.width * world.cellSize
    const townZ = world.grid.height * world.cellSize
    const tiers: Tier[] = []

    for (let level = 0; level < specs.length; level++) {
      const { step, reach } = specs[level]!
      const unit = specs[level + 1]?.step ?? step
      const xs = axis(step, -roundUp(reach, unit), roundUp(townX + reach, unit))
      const zs = axis(step, -roundUp(reach, unit), roundUp(townZ + reach, unit))

      let hole: Tier['hole']
      if (level === 0) {
        // the finest lattice has to leave the built area alone to the metre, so
        // its line nearest the far edge of the map is moved onto it
        snapTo(xs, townX)
        snapTo(zs, townZ)
        hole = { i0: indexOf(xs, 0), i1: indexOf(xs, townX), j0: indexOf(zs, 0), j1: indexOf(zs, townZ) }
      } else {
        const inner = tiers[level - 1]!
        hole = {
          i0: indexOf(xs, inner.xs[0]!),
          i1: indexOf(xs, inner.xs[inner.xs.length - 1]!),
          j0: indexOf(zs, inner.zs[0]!),
          j1: indexOf(zs, inner.zs[inner.zs.length - 1]!),
        }
      }

      const heights = new Float32Array(xs.length * zs.length)
      for (let j = 0; j < zs.length; j++) {
        for (let i = 0; i < xs.length; i++) heights[j * xs.length + i] = field.at(xs[i]!, zs[j]!)
      }
      tiers.push({ step, xs, zs, heights, hole })
    }

    for (let level = 0; level < tiers.length - 1; level++) weld(tiers[level]!, tiers[level + 1]!)
    return new Ground(tiers, field, { x1: townX, z1: townZ })
  }

  /** Height of the rendered surface, in metres. Zero over the built area. */
  heightAt(x: number, z: number): number {
    const found = this.#cell(x, z)
    if (!found) return this.#field.at(x, z)
    const { tier, i, j } = found
    const x0 = tier.xs[i]!
    const z0 = tier.zs[j]!
    const u = (x - x0) / (tier.xs[i + 1]! - x0)
    const v = (z - z0) / (tier.zs[j + 1]! - z0)
    const row = tier.xs.length
    const h00 = tier.heights[j * row + i]!
    const h11 = tier.heights[(j + 1) * row + i + 1]!
    // the quad is two triangles split along its own diagonal, and the answer has
    // to come off the same triangle the eye sees
    if (u > v) {
      const h10 = tier.heights[j * row + i + 1]!
      return h00 + (h10 - h00) * u + (h11 - h10) * v
    }
    const h01 = tier.heights[(j + 1) * row + i]!
    return h00 + (h01 - h00) * v + (h11 - h01) * u
  }

  /** Rise over run of the triangle under a point: 1 is forty-five degrees. */
  slopeAt(x: number, z: number): number {
    const found = this.#cell(x, z)
    if (!found) return 0
    const { tier, i, j } = found
    const dx = tier.xs[i + 1]! - tier.xs[i]!
    const dz = tier.zs[j + 1]! - tier.zs[j]!
    const u = (x - tier.xs[i]!) / dx
    const v = (z - tier.zs[j]!) / dz
    const row = tier.xs.length
    const h00 = tier.heights[j * row + i]!
    const h11 = tier.heights[(j + 1) * row + i + 1]!
    if (u > v) {
      const h10 = tier.heights[j * row + i + 1]!
      return Math.hypot((h10 - h00) / dx, (h11 - h10) / dz)
    }
    const h01 = tier.heights[(j + 1) * row + i]!
    return Math.hypot((h11 - h01) / dx, (h01 - h00) / dz)
  }

  /** Every quad of every tier, finest first. The built area is not among them. */
  *quads(): Generator<Quad> {
    for (const tier of this.#tiers) {
      const row = tier.xs.length
      for (let j = 0; j < tier.zs.length - 1; j++) {
        const inRowsOfHole = j >= tier.hole.j0 && j < tier.hole.j1
        for (let i = 0; i < tier.xs.length - 1; i++) {
          if (inRowsOfHole && i >= tier.hole.i0 && i < tier.hole.i1) continue
          yield {
            x0: tier.xs[i]!,
            z0: tier.zs[j]!,
            x1: tier.xs[i + 1]!,
            z1: tier.zs[j + 1]!,
            h00: tier.heights[j * row + i]!,
            h10: tier.heights[j * row + i + 1]!,
            h11: tier.heights[(j + 1) * row + i + 1]!,
            h01: tier.heights[(j + 1) * row + i]!,
          }
        }
      }
    }
  }

  /** Metres from the middle of the map to the far edge of the land. */
  get reach(): number {
    const outer = this.#tiers[this.#tiers.length - 1]!
    return outer.xs[outer.xs.length - 1]! - this.#town.x1 / 2
  }

  /** Height along one line of the finest tier, for the verge to weld itself to. */
  seamAt(x: number, z: number): number {
    return chord(this.#tiers[0]!, x, z)
  }

  #cell(x: number, z: number): { tier: Tier; i: number; j: number } | undefined {
    for (const tier of this.#tiers) {
      if (x < tier.xs[0]! || x > tier.xs[tier.xs.length - 1]!) continue
      if (z < tier.zs[0]! || z > tier.zs[tier.zs.length - 1]!) continue
      const i = cellOf(tier.xs, x)
      const j = cellOf(tier.zs, z)
      if (i >= tier.hole.i0 && i < tier.hole.i1 && j >= tier.hole.j0 && j < tier.hole.j1) continue
      return { tier, i, j }
    }
    return undefined
  }
}

/**
 * Pull a tier's outermost ring of heights onto the coarse edge it meets, so the
 * points the coarse tier does not have cannot poke through the seam.
 */
function weld(fine: Tier, coarse: Tier): void {
  const row = fine.xs.length
  const last = fine.zs.length - 1
  for (let i = 0; i < row; i++) {
    fine.heights[i] = chord(coarse, fine.xs[i]!, fine.zs[0]!)
    fine.heights[last * row + i] = chord(coarse, fine.xs[i]!, fine.zs[last]!)
  }
  for (let j = 0; j < fine.zs.length; j++) {
    fine.heights[j * row] = chord(coarse, fine.xs[0]!, fine.zs[j]!)
    fine.heights[j * row + row - 1] = chord(coarse, fine.xs[row - 1]!, fine.zs[j]!)
  }
}

/**
 * A tier's height along one of its own lattice lines. Both seams run along a
 * line of the coarse lattice, so this is the straight edge of its quads.
 */
function chord(tier: Tier, x: number, z: number): number {
  const i = cellOf(tier.xs, x)
  const j = cellOf(tier.zs, z)
  const row = tier.xs.length
  const onX = Math.abs(z - tier.zs[j]!) < 1e-6 || Math.abs(z - tier.zs[j + 1]!) < 1e-6
  if (onX) {
    const line = Math.abs(z - tier.zs[j]!) < 1e-6 ? j : j + 1
    const t = (x - tier.xs[i]!) / (tier.xs[i + 1]! - tier.xs[i]!)
    const a = tier.heights[line * row + i]!
    return a + (tier.heights[line * row + i + 1]! - a) * t
  }
  const line = Math.abs(x - tier.xs[i]!) < 1e-6 ? i : i + 1
  const t = (z - tier.zs[j]!) / (tier.zs[j + 1]! - tier.zs[j]!)
  const a = tier.heights[j * row + line]!
  return a + (tier.heights[(j + 1) * row + line]! - a) * t
}

function axis(step: number, min: number, max: number): Float64Array {
  const count = Math.round((max - min) / step) + 1
  const out = new Float64Array(count)
  for (let i = 0; i < count; i++) out[i] = min + i * step
  return out
}

/** Move the lattice line nearest this coordinate onto it. */
function snapTo(values: Float64Array, target: number): void {
  let best = 0
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i]! - target) < Math.abs(values[best]! - target)) best = i
  }
  values[best] = target
}

function roundUp(value: number, unit: number): number {
  return Math.ceil(value / unit) * unit
}

function indexOf(values: Float64Array, target: number): number {
  let low = 0
  let high = values.length - 1
  while (low < high) {
    const middle = (low + high) >> 1
    if (values[middle]! < target - 1e-6) low = middle + 1
    else high = middle
  }
  return low
}

/** The cell a coordinate falls in: the last line at or before it. */
function cellOf(values: Float64Array, target: number): number {
  let low = 0
  let high = values.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (values[middle]! <= target) low = middle
    else high = middle - 1
  }
  return Math.min(low, values.length - 2)
}
