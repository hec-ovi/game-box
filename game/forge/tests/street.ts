import type { World } from '@gb/world'

/**
 * Who is out walking, the way the running game sends people out.
 *
 * `@gb/app` reads the roster in the city's own order and sends at most a third
 * of the town out at once, never the last person out of a room, so a bar keeps
 * its regulars rather than its bartender alone. This is that rule, written
 * against the app's contract rather than its code, with one addition the
 * harness is here to measure: anybody the player's quest is waiting on stays
 * at their post when the game keeps quest targets in, and does not when it
 * does not.
 */
export class Street {
  readonly #world: World
  readonly #share: number

  constructor(world: World, share = 1 / 3) {
    this.#world = world
    this.#share = share
  }

  /** Everybody out on the pavement right now, given who has to stay in. */
  out(kept: ReadonlySet<string>): ReadonlySet<string> {
    const npcs = this.#world.npcs()
    const inside = new Map<string, number>()
    for (const npc of npcs) if (npc.station) inside.set(npc.station.interiorId, (inside.get(npc.station.interiorId) ?? 0) + 1)

    const out = new Set<string>()
    const most = Math.floor(npcs.length * this.#share)
    for (const npc of npcs) {
      if (out.size >= most) break
      if (kept.has(npc.id) || !npc.station) continue
      const left = inside.get(npc.station.interiorId) ?? 0
      if (left < 2) continue
      inside.set(npc.station.interiorId, left - 1)
      out.add(npc.id)
    }
    return out
  }
}
