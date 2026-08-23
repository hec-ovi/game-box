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
 * Where a quest is sending the player. A step names a place, a person or a
 * thing, and `@gb/quest` publishes whichever it is; the city knows where any of
 * those stands. Steps that point at nothing at all are left out, because there
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

/**
 * A place beats a person and a person beats a thing: a delivery names both the
 * courier's stop and the parcel, and the stop is where the player has to go.
 */
function spot(world: World, objective: Objective): Marked | undefined {
  const plotId = plotOf(world, objective)
  if (plotId) return atPlot(world, plotId)

  if (objective.npcId) {
    const at = world.positionOf(objective.npcId)
    const npc = world.npc(objective.npcId)
    return at && npc ? { label: npc.name, x: at.x, z: at.z } : undefined
  }

  // a step to go and fetch something names only the thing, so the city has to
  // say where the thing is lying. Any of the pool will do, which is what makes
  // "three of the five crates" one pin rather than five
  for (const itemId of [objective.itemId, ...(objective.alternates ?? [])]) {
    const at = itemId ? whereItLies(world, itemId) : undefined
    if (at) return at
  }
  return undefined
}

/** The building an objective points at, whether it named the plot or the room inside it. */
function plotOf(world: World, objective: Objective): string | undefined {
  const place = objective.place
  if (!place) return undefined
  if ('plotId' in place) return place.plotId
  return interiorPlot(world, place.interiorId)
}

/**
 * Where a thing is: the door of the building it is in, the person carrying it,
 * or the patch of street it is lying on. `positionOf` answers for people and
 * plots and not for a thing on a shelf, because a shelf is inside a room and a
 * room has its own metres, so this goes thing to room to building.
 */
function whereItLies(world: World, itemId: string): Marked | undefined {
  const placement = world.placements().find((held) => held.itemId === itemId)
  if (!placement) return undefined

  if (placement.at === 'anchor') {
    const plotId = interiorPlot(world, placement.interiorId)
    return plotId ? atPlot(world, plotId) : undefined
  }
  if (placement.at === 'npc') {
    const at = world.positionOf(placement.npcId)
    const npc = world.npc(placement.npcId)
    return at && npc ? { label: npc.name, x: at.x, z: at.z } : undefined
  }
  const size = world.cellSize
  const name = world.item(itemId)?.name
  return name ? { label: name, x: (placement.cell.x + 0.5) * size, z: (placement.cell.y + 0.5) * size } : undefined
}

/** Which building a room is inside. */
function interiorPlot(world: World, interiorId: string): string | undefined {
  return world.plots().find((plot) => plot.interiorId === interiorId)?.id
}

/** A building, pinned on its doorstep so a route can walk to the door. */
function atPlot(world: World, plotId: string): Marked | undefined {
  const at = world.positionOf(plotId)
  const plot = world.plot(plotId)
  return at && plot ? { label: plot.name, x: at.x, z: at.z, plotId } : undefined
}
