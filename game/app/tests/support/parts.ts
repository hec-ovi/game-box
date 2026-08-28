import type { Hud } from '@gb/hud'
import { CityNav } from '@gb/nav'
import { buildInterior, type CityBuild, type InteriorBuild } from '@gb/scene'
import type { PlayerState } from '@gb/play'
import type { QuestLog, WorldView } from '@gb/quest'
import type { World } from '@gb/world'
import type { Buildings } from '../../src/buildings.ts'
import { Counters } from '../../src/counters.ts'
import { Locks } from '../../src/locks.ts'
import { Machines } from '../../src/machines.ts'
import type { Reporting } from '../../src/reporting.ts'
import type { CityArt } from '../../src/rooms.ts'

/** A world that says yes to everything a quest names, for a quest written against a fixture. */
export const anyWorld: WorldView = {
  hasNpc: () => true,
  hasPlot: () => true,
  hasInterior: () => true,
  hasItem: () => true,
  hasAnchor: () => true,
  hasDoor: () => true,
  hasMachine: () => true,
  opens: () => true,
}

/** The locks of a city, over its own room graph, the way the game builds them. */
export function lockUp(input: { world: World; player: PlayerState; log: QuestLog; report: Reporting; nav?: CityNav }): Locks {
  return new Locks({ ...input, nav: input.nav ?? CityNav.from(input.world) })
}

/** The screens on the desks and the counters people keep, for a room that is already open. */
export function fittings(input: {
  world: World
  player: PlayerState
  log: QuestLog
  hud: Hud
  report: Reporting
  buildings: Buildings
  locks: Locks
}): { machines: Machines; counters: Counters } {
  return { machines: new Machines(input), counters: new Counters(input) }
}

/**
 * A city with nothing in it but its doorsteps and its rooms, for a test about
 * one doorway. `Buildings` asks `@gb/scene`'s city for a room by id and builds
 * nothing itself, so a stub has to answer the same way: built on the first ask,
 * the same room after, and the art it is aimed at is the art it is built in.
 */
export function doorwaysOnly(world: World, doorsteps: Map<string, { x: number; z: number }>, art: CityArt): CityBuild {
  const built = new Map<string, InteriorBuild>()
  const interiors = new Set<string>()
  return {
    doorsteps,
    interiors,
    interior(interiorId: string) {
      const standing = built.get(interiorId)
      if (standing) return standing
      const interior = world.interior(interiorId)
      if (!interior) return undefined
      const room = buildInterior(world, interior, art.seam)
      built.set(interiorId, room)
      interiors.add(interiorId)
      return room
    },
  } as unknown as CityBuild
}
