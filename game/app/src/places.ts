import type { Objective } from '@gb/quest'
import type { World } from '@gb/world'

/** Somewhere the tracked quest points at, found on the city. */
export interface Marked {
  /** What to write beside the pin. */
  readonly label: string
  /** In metres. */
  readonly x: number
  readonly z: number
  /** The building it is, when it is one, so a route can walk to its door. */
  readonly plotId?: string
}

/**
 * Where a quest is sending the player. A step names a person or a place and
 * `@gb/quest` publishes whichever it is; the city knows where either of those
 * stands. Steps that point at nobody and nowhere are left out, because there
 * is nothing to put on a map for them.
 */
export function marked(world: World, objectives: readonly Objective[]): Marked[] {
  const found: Marked[] = []
  const seen = new Set<string>()

  for (const objective of objectives) {
    const place = spot(world, objective)
    if (!place) continue
    // two steps of one quest often send the player back to the same door, and
    // two pins on one spot read as two places
    const where = `${place.x}/${place.z}`
    if (seen.has(where)) continue
    seen.add(where)
    found.push({ ...place, label: objective.markerLabel ?? place.label })
  }
  return found
}

function spot(world: World, objective: Objective): Marked | undefined {
  const plotId = plotOf(world, objective)
  if (plotId) {
    const at = world.positionOf(plotId)
    const plot = world.plot(plotId)
    return at && plot ? { label: plot.name, x: at.x, z: at.z, plotId } : undefined
  }

  if (objective.npcId) {
    const at = world.positionOf(objective.npcId)
    const npc = world.npc(objective.npcId)
    return at && npc ? { label: npc.name, x: at.x, z: at.z } : undefined
  }
  return undefined
}

/** The building an objective points at, whether it named the plot or the room inside it. */
function plotOf(world: World, objective: Objective): string | undefined {
  const place = objective.place
  if (!place) return undefined
  if ('plotId' in place) return place.plotId
  return world.plots().find((plot) => plot.interiorId === place.interiorId)?.id
}
