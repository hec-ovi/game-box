/** One bit per cell: a whole 469x469 city's worth of yes-or-no is 27 KB. */
export class CellBits {
  readonly #bytes: Uint8Array
  #count = 0

  constructor(size: number) {
    this.#bytes = new Uint8Array((size + 7) >> 3)
  }

  /** How many bits are set. */
  get count(): number {
    return this.#count
  }

  /** Bytes held, so a caller can weigh keeping one around. */
  get byteLength(): number {
    return this.#bytes.length
  }

  has(index: number): boolean {
    return (this.#bytes[index >> 3]! & (1 << (index & 7))) !== 0
  }

  /** Sets the bit and says whether it was new, which is the visited test a flood fill needs. */
  add(index: number): boolean {
    const byte = index >> 3
    const mask = 1 << (index & 7)
    if ((this.#bytes[byte]! & mask) !== 0) return false
    this.#bytes[byte] = this.#bytes[byte]! | mask
    this.#count++
    return true
  }
}
