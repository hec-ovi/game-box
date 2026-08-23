import type { RiderBody, RiderCast, RiderCrowd, Riders } from './ports.ts'

/**
 * The companions, over a crowd. Getting into a car takes them out of the crowd
 * and gives this box a body to seat; getting out hands them back, walking with
 * the player again from wherever the car stopped.
 *
 * Nothing here imports `@gb/crowd`: a `Crowd` and a `SceneCast` answer these
 * questions already, which is why the game can hand them straight over.
 */
export class CrowdRiders implements Riders {
  readonly #crowd: RiderCrowd
  readonly #cast: RiderCast

  constructor(input: { crowd: RiderCrowd; cast: RiderCast }) {
    this.#crowd = input.crowd
    this.#cast = input.cast
  }

  waiting(): readonly string[] {
    return this.#crowd.following().map((walker) => walker.id)
  }

  pickUp(npcId: string): RiderBody | undefined {
    const npc = this.#crowd.person(npcId)
    if (!npc) return undefined
    // out of the crowd first, or the same person is walking the pavement and
    // sitting in the passenger seat at once
    this.#crowd.stopFollowing(npcId)
    return this.#cast.spawn(npc)
  }

  putDown(npcId: string, x: number, z: number): void {
    const npc = this.#crowd.person(npcId)
    if (npc) this.#crowd.follow({ npc, at: { x, z } })
  }
}
