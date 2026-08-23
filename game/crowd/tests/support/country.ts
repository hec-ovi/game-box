import type { CrowdGround } from '../../src/index.ts'

/**
 * The ground outside the city, the way `@gb/land` answers for it: flat and at
 * zero over the town, then falling away past the edge of the map. Give it
 * `walkable: false` for a landscape nobody may stand in, which is how a test
 * asks what a companion does when the game has nowhere to put them.
 */
export class Country implements CrowdGround {
  #edge: number
  #fall: number
  #walkable: boolean

  constructor(edge: number, { fall = 40, walkable = true } = {}) {
    this.#edge = edge
    this.#fall = fall
    this.#walkable = walkable
  }

  /** Zero over the town, then a metre down every `fall` metres out. */
  heightAt(x: number, z: number): number {
    const out = Math.max(Math.hypot(x, z) - this.#edge, 0)
    return -out / this.#fall
  }

  walkableAt(): boolean {
    return this.#walkable
  }
}
