/**
 * The range rule of a conversation: it is over once the player, having come
 * within `radius` of the person, is further than that from them again. Until
 * they have come that close nothing about distance ends it, so a hold taken on
 * somebody across the road stands while the player walks over to them.
 *
 * Walkers apply it to themselves. It is published so a person at a post
 * indoors, who is nobody's walker, can be measured by the same rule with the
 * same number.
 */
export class Leash {
  #radius: number
  #near = false

  constructor(radius: number) {
    this.#radius = radius
  }

  /** A new conversation: the player has not come close yet. */
  reset(): void {
    this.#near = false
  }

  /** Given the offset from the person to the player in metres, true once the player has walked out of range. */
  gone(dx: number, dz: number): boolean {
    const away = Math.hypot(dx, dz)
    if (away <= this.#radius) this.#near = true
    return this.#near && away > this.#radius
  }
}
