import type { MapPlot } from '@gb/hud'
import type { Objective, QuestKind } from '@gb/quest'
import type { World } from '@gb/world'

/**
 * Every building on the plan: its footprint in cells, its name for the hover
 * and its charter's standing for its fill. The plan and the corner draw the
 * same city, so both read it from here and neither surveys anything: the grid
 * the city was generated on is the plan.
 */
export function planOf(world: World): MapPlot[] {
  return world.plots().map((plot) => {
    const prominence = world.charter(plot.kind)?.prominence
    return { id: plot.id, rect: plot.rect, label: plot.name, ...(prominence ? { prominence } : {}) }
  })
}

/** Somewhere a quest points at, found on the city. */
export interface Marked {
  /** The map's handle on it, so a callout clicked names this and nothing else. */
  readonly id: string
  /** What to write beside the pin. */
  readonly label: string
  /** In metres. */
  readonly x: number
  readonly z: number
  /** The building it is, when it is one, so a route can walk to its door. */
  readonly plotId?: string
  /** The story or an errand, so the plan and the compass draw the two apart. */
  readonly line: QuestKind
  /** The quest sending the player here, on a goal, so picking the quest picks this. */
  readonly questId?: string
}

/** Where somebody is right now when they are not at their post: the door they are walking to, or the ground they stand on. */
export type Whereabouts = (npcId: string) => { plotId: string } | { x: number; z: number } | undefined

/**
 * Where quests are sending the player. A step names a place, a person or a
 * thing, and `@gb/quest` publishes whichever it is; the city knows where any of
 * those stands, and the street knows where somebody out walking is. Steps that
 * point at nothing at all are left out, because there is nothing to put on a
 * map for them.
 */
export function marked(world: World, objectives: readonly Objective[], lineOf: (questId: string) => QuestKind, out: Whereabouts = () => undefined): Marked[] {
  const found: Marked[] = []
  const seen = new Set<string>()

  for (const objective of objectives) {
    const place = spot(world, objective, out)
    if (!place) continue
    // two steps of one quest often send the player back to the same door, and
    // two pins on one spot read as two places
    const where = `${place.x}/${place.z}`
    if (seen.has(where)) continue
    seen.add(where)
    found.push({
      ...place,
      id: `goal:${objective.questId}:${objective.stepId}`,
      label: objective.markerLabel ?? place.label,
      line: lineOf(objective.questId),
      questId: objective.questId,
    })
  }
  return found
}

/** The quest log as this reads it: who is holding work the player has not taken. */
export interface OnOffer {
  offeredBy(npcId: string): readonly { readonly kind: QuestKind }[]
}

/**
 * Where there is work to pick up: everybody holding a job the player could
 * take, at the door of the place they keep or wherever they are walking. A
 * player who has taken nothing has nowhere to start otherwise, because the
 * only thing that puts a mark on the plan today is a step already on the board.
 */
export function offered(world: World, log: OnOffer, out: Whereabouts = () => undefined): Marked[] {
  const found: Marked[] = []
  const seen = new Set<string>()

  for (const npc of world.npcs()) {
    const work = log.offeredBy(npc.id)[0]
    if (!work) continue
    const place = somebody(world, npc.id, out)
    if (!place) continue
    // two people behind one counter are one door to walk to
    const where = `${place.x}/${place.z}`
    if (seen.has(where)) continue
    seen.add(where)
    found.push({ ...place, id: `offer:${npc.id}`, line: work.kind })
  }
  return found
}

type Spot = Omit<Marked, 'line' | 'id' | 'questId'>

/**
 * A place beats a person and a person beats a thing: a delivery names both the
 * courier's stop and the parcel, and the stop is where the player has to go.
 */
function spot(world: World, objective: Objective, out: Whereabouts): Spot | undefined {
  const plotId = plotOf(world, objective)
  if (plotId) return atPlot(world, plotId)
  if (objective.npcId) return somebody(world, objective.npcId, out)

  // a step to go and fetch something names only the thing, so the city has to
  // say where the thing is lying. Any of the pool will do, which is what makes
  // "three of the five crates" one pin rather than five
  for (const itemId of [objective.itemId, ...(objective.alternates ?? [])]) {
    const at = itemId ? whereItLies(world, itemId, out) : undefined
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
function whereItLies(world: World, itemId: string, out: Whereabouts): Spot | undefined {
  const placement = world.placements().find((held) => held.itemId === itemId)
  if (!placement) return undefined

  if (placement.at === 'anchor') {
    const plotId = interiorPlot(world, placement.interiorId)
    return plotId ? atPlot(world, plotId) : undefined
  }
  if (placement.at === 'npc') return somebody(world, placement.npcId, out)
  const size = world.cellSize
  const name = world.item(itemId)?.name
  return name ? { label: name, x: (placement.cell.x + 0.5) * size, z: (placement.cell.y + 0.5) * size } : undefined
}

/**
 * Where a person is: out walking, the door they are heading for, so the pin
 * and the route go where they will be found rather than to an empty room; on
 * the pavement with nowhere in particular to go, the spot they stand on; and
 * otherwise the door of the place they keep, which is the building the plan
 * writes a name on.
 */
function somebody(world: World, npcId: string, out: Whereabouts): Spot | undefined {
  const npc = world.npc(npcId)
  if (!npc) return undefined
  const away = out(npcId)
  const post = npc.station ? interiorPlot(world, npc.station.interiorId) : undefined
  const plotId = away && 'plotId' in away ? away.plotId : away ? undefined : post
  const door = plotId ? atPlot(world, plotId) : undefined
  if (door) return { ...door, label: npc.name }
  const at = away && 'x' in away ? away : world.positionOf(npcId)
  return at ? { label: npc.name, x: at.x, z: at.z } : undefined
}

/** Which building a room is inside. */
export function interiorPlot(world: World, interiorId: string): string | undefined {
  return world.plots().find((plot) => plot.interiorId === interiorId)?.id
}

/** A building, pinned on its doorstep so a route can walk to the door. */
function atPlot(world: World, plotId: string): Spot | undefined {
  const at = world.positionOf(plotId)
  const plot = world.plot(plotId)
  return at && plot ? { label: plot.name, x: at.x, z: at.z, plotId } : undefined
}
