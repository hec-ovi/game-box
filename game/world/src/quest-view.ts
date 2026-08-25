import type { World } from './world.ts'

/**
 * The questions the quest layer asks about a world, and the only thing it is
 * allowed to ask. Keeping the port this narrow is what lets a quest be
 * validated against a city without knowing how the city was built.
 */
export interface QuestView {
  hasNpc(id: string): boolean
  hasPlot(id: string): boolean
  hasInterior(id: string): boolean
  hasItem(id: string): boolean
  hasAnchor(interiorId: string, anchorId: string): boolean
  /** A door a lock, a key or an access reward may name. */
  hasDoor(doorId: string): boolean
  /** A machine a hack or a password may name. */
  hasMachine(machineId: string): boolean
}

/** A world seen through that port. Pass the result to `@gb/quest`. */
export function questView(world: World): QuestView {
  return {
    hasNpc: (id) => world.hasNpc(id),
    hasPlot: (id) => world.hasPlot(id),
    hasInterior: (id) => world.hasInterior(id),
    hasItem: (id) => world.hasItem(id),
    hasAnchor: (interiorId, anchorId) => world.interior(interiorId)?.anchors.some((a) => a.id === anchorId) ?? false,
    hasDoor: (doorId) => world.hasDoor(doorId),
    hasMachine: (machineId) => world.hasMachine(machineId),
  }
}
