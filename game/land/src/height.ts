import type { OpenField } from './field.ts'
import type { Noise } from './noise.ts'
import type { LandTheme } from './theme.ts'

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
 * The height of the land at any point, in metres above the city's plain.
 *
 * Zero on the town and its roads, a gentle skirt around them, then the ring
 * climbing to its crest and coming back down to a plain that runs to the
 * horizon. Hills are laid over the ring and fade out before they reach the
 * town, so the streets never end in a slope.
 */
export class HeightField {
  readonly #field: OpenField
  readonly #theme: LandTheme
  readonly #noise: Noise
  readonly #flat: number
  readonly #shore: number
  readonly #feather: number
  readonly #basins: Basin[] = []

  constructor(field: OpenField, theme: LandTheme, noise: Noise, flat: number) {
    this.#field = field
    this.#theme = theme
    this.#noise = noise
    this.#flat = flat
    this.#shore = theme.relief.skirt * 0.4
    this.#feather = theme.relief.skirt + theme.relief.climb * 0.5
  }

  /** How far out the ring reaches before the land settles into its outer plain. */
  static reach(theme: LandTheme): number {
    const { skirt, climb, crest, descent } = theme.relief
    return skirt + climb + crest + descent
  }

  addBasin(basin: Basin): void {
    this.#basins.push(basin)
  }

  /** The land before any water was carved into it. */
  base(x: number, z: number): number {
    const away = Math.max(0, this.#field.at(x, z) - this.#flat)
    const height = this.#profile(away)
    const mask = clamp01((away - this.#shore) / this.#feather)
    if (mask <= 0) return height

    const { hills, hillScale, rough, roughScale } = this.#theme.relief
    const broad = this.#noise.fbm(x / hillScale, z / hillScale, 4) * hills
    const grain = this.#noise.fbm(x / roughScale + 71.3, z / roughScale - 19.7, 2) * rough
    return height + (broad + grain * mask) * mask
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

  /** The water level at a point, when it is standing in one of the basins. */
  waterAt(x: number, z: number): number | undefined {
    for (const basin of this.#basins) {
      if (Math.hypot(x - basin.x, z - basin.z) >= basin.radius) continue
      if (this.at(x, z) <= basin.surface) return basin.surface
    }
    return undefined
  }

  /** Metres from the nearest open ground: zero on the town and on the road out. */
  awayFromTown(x: number, z: number): number {
    return this.#field.at(x, z)
  }

  #profile(away: number): number {
    const { skirt, skirtHeight, climb, peak, crest, descent, plain } = this.#theme.relief
    if (away <= 0) return 0
    if (away < skirt) return skirtHeight * smoothstep01(away / skirt)

    const up = away - skirt
    if (up < climb) return skirtHeight + peak * smoothstep01(up / climb)
    if (up < climb + crest) return skirtHeight + peak
    const down = up - climb - crest
    if (down >= descent) return plain
    const top = skirtHeight + peak
    return top + (plain - top) * smoothstep01(down / descent)
  }
}

export function smoothstep01(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}
