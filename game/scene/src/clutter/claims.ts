/** How finely the street is divided for deciding what is already occupied, in metres. */
const STEP = 0.25

/**
 * The street as a matrix of small squares, each one either free or taken.
 *
 * A piece of rubbish is a rectangle of squares and it claims them, so two
 * things cannot end up in the same place by construction rather than by a test
 * afterwards that might miss. It is the same rule a room places furniture by.
 */
export class Claims {
  #width: number
  #taken: Uint8Array

  constructor(spanX: number, spanZ: number) {
    this.#width = Math.max(1, Math.ceil(spanX / STEP))
    this.#taken = new Uint8Array(this.#width * Math.max(1, Math.ceil(spanZ / STEP)))
  }

  /** Takes the rectangle if every square of it is free, and answers whether it did. */
  claim(x: number, z: number, halfX: number, halfZ: number): boolean {
    const from = { x: Math.floor((x - halfX) / STEP), z: Math.floor((z - halfZ) / STEP) }
    const to = { x: Math.floor((x + halfX) / STEP), z: Math.floor((z + halfZ) / STEP) }
    for (let j = from.z; j <= to.z; j++) {
      for (let i = from.x; i <= to.x; i++) {
        const at = this.#at(i, j)
        if (at === undefined || this.#taken[at]) return false
      }
    }
    for (let j = from.z; j <= to.z; j++) {
      for (let i = from.x; i <= to.x; i++) this.#taken[this.#at(i, j)!] = 1
    }
    return true
  }

  #at(i: number, j: number): number | undefined {
    if (i < 0 || j < 0 || i >= this.#width) return undefined
    const at = j * this.#width + i
    return at < this.#taken.length ? at : undefined
  }
}
