/**
 * Deterministic randomness. Same seed, same stream, forever.
 *
 * `fork` is the important part: a generator that forks a child stream per plot
 * or per NPC can add a new one later without shifting anything already made.
 */
export class Rng {
  #a: number
  #b: number
  #c: number
  #d: number

  readonly seed: string

  constructor(seed: string) {
    this.seed = seed
    const [a, b, c, d] = hash128(seed)
    this.#a = a
    this.#b = b
    this.#c = c
    this.#d = d
  }

  /** A child stream, stable for this label whatever else the parent does. */
  fork(label: string): Rng {
    return new Rng(`${this.seed}/${label}`)
  }

  /** [0, 1) */
  float(): number {
    // sfc32
    const t = (((this.#a + this.#b) | 0) + this.#d) | 0
    this.#d = (this.#d + 1) | 0
    this.#a = this.#b ^ (this.#b >>> 9)
    this.#b = (this.#c + (this.#c << 3)) | 0
    this.#c = (this.#c << 21) | (this.#c >>> 11)
    this.#c = (this.#c + t) | 0
    return (t >>> 0) / 4294967296
  }

  /** [min, max) */
  int(min: number, max: number): number {
    if (max <= min) return min
    return min + Math.floor(this.float() * (max - min))
  }

  range(min: number, max: number): number {
    return min + this.float() * (max - min)
  }

  chance(probability: number): boolean {
    return this.float() < probability
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty list')
    return items[this.int(0, items.length)] as T
  }

  /** Pick by relative weight. Weights need not sum to 1. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
    if (total <= 0) throw new Error('weighted pick needs one positive weight')
    let roll = this.float() * total
    for (const [item, weight] of entries) {
      roll -= Math.max(0, weight)
      if (roll <= 0) return item
    }
    return entries[entries.length - 1]![0]
  }

  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1)
      ;[out[i], out[j]] = [out[j] as T, out[i] as T]
    }
    return out
  }
}

/** cyrb128: string -> four 32-bit seeds. */
function hash128(input: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  return [
    (Math.imul(h3 ^ (h1 >>> 18), 597399067) >>> 0),
    (Math.imul(h4 ^ (h2 >>> 22), 2869860233) >>> 0),
    (Math.imul(h1 ^ (h3 >>> 17), 951274213) >>> 0),
    (Math.imul(h2 ^ (h4 >>> 19), 2716044179) >>> 0),
  ]
}
