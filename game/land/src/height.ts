import type { OpenField } from './field.ts'
import type { Noise } from './noise.ts'
import type { LandTheme } from './theme.ts'

/** Metres of open ground kept perfectly flat around the town and its roads. */
const FLAT = 12
/** Metres over which the rolling ground fades in past that. */
const FEATHER = 90
/** Metres of height that doubles the relief: the higher the land, the rougher it gets. */
const CRAG = 200

/** A carved bowl in the land, with the water level it holds. */
export interface Basin {
  readonly x: number
  readonly z: number
  /** Metres. How far the carve reaches; the water itself is smaller than this. */
  readonly radius: number
  /** Height of the bed at the centre, of the lowest point of the rim, and of the water. */
  readonly bed: number
  readonly rim: number
  readonly surface: number
}

/**
 * The height of the land at any point, in metres above the town's ground.
 *
 * Zero on the town and its roads, a bank rising from their very edge so the
 * town sits in a valley, then kilometres of open ground that rolls but barely
 * climbs, then the ring: foothills, a long climb to the crest, and a descent to
 * a plateau that runs to the horizon. The rolling comes from three sizes of
 * noise laid over the profile and fades out before it reaches the streets, so
 * the town sits on a flat floor and everything outside it does not.
 */
export class HeightField {
  readonly #field: OpenField
  readonly #theme: LandTheme
  readonly #noise: Noise
  readonly #basins: Basin[] = []

  constructor(field: OpenField, theme: LandTheme, noise: Noise) {
    this.#field = field
    this.#theme = theme
    this.#noise = noise
  }

  /** How far out the ring reaches before the land settles into its outer plateau. */
  static reach(theme: LandTheme): number {
    const { open, climb, crest, descent } = theme.relief
    return open + climb + crest + descent
  }

  addBasin(basin: Basin): void {
    this.#basins.push(basin)
  }

  /** The land before any water was carved into it. */
  base(x: number, z: number): number {
    const away = this.#field.at(x, z)
    const height = this.#profile(away)
    if (away <= FLAT) return height

    const mask = clamp01((away - FLAT) / FEATHER)
    const { broad, broadScale, mid, midScale, fine, fineScale } = this.#theme.relief
    const rolling =
      this.#noise.fbm(x / broadScale, z / broadScale, 4) * broad +
      this.#noise.fbm(x / midScale + 31.7, z / midScale - 12.3, 3) * mid +
      this.#noise.fbm(x / fineScale + 71.3, z / fineScale - 19.7, 2) * fine
    // high ground is broken ground: the same shapes, taller, once the ring lifts
    return height + rolling * mask * (1 + height / CRAG)
  }

  /** The land as it is built: base height with every basin cut into it. */
  at(x: number, z: number): number {
    let height = this.base(x, z)
    for (const basin of this.#basins) {
      const distance = Math.hypot(x - basin.x, z - basin.z)
      if (distance >= basin.radius) continue
      const t = distance / basin.radius
      const weight = (1 - t * t) ** 2
      const target = basin.bed + (basin.rim - basin.bed) * t * t
      height = height * (1 - weight) + target * weight
    }
    return height
  }

  /** Metres from the nearest open ground: zero on the town and on the road out. */
  awayFromTown(x: number, z: number): number {
    return this.#field.at(x, z)
  }

  /** The bank at the town's edge, and the ring's profile laid on top of it. */
  #profile(away: number): number {
    const { bank, bankRun } = this.#theme.relief
    if (away <= 0) return 0
    return bank * smoothstep01(away / bankRun) + this.#ring(away)
  }

  #ring(away: number): number {
    const { open, openLift, climb, peak, crest, descent, plateau } = this.#theme.relief
    if (away < open) return openLift * smoothstep01(away / open)

    const up = away - open
    if (up < climb) return openLift + peak * smoothstep01(up / climb)
    if (up < climb + crest) return openLift + peak
    const down = up - climb - crest
    if (down >= descent) return plateau
    const top = openLift + peak
    return top + (plateau - top) * smoothstep01(down / descent)
  }
}

export function smoothstep01(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}
