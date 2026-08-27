import { cellCentre, type Furniture, type Interior, type Premise, type Word, type WorkKind, type World } from '@gb/world'
import { instanceName, personName, thingName } from './naming/placeholders.ts'
import type { SummaryLock, SummaryMachine, WorldSummary } from './narrator.ts'
import { surfacesOf } from './populate.ts'
import type { PlannedSite } from './raise/planned.ts'

type Place = WorldSummary['places'][number]
type SummaryNpc = Place['npcs'][number]
type SummaryItem = Place['items'][number]

/** One building as the quest writer is shown it, before it is a summary: the shell, and whoever and whatever is in it. */
interface Standing {
  readonly interiorId: string
  /** By room id. */
  readonly rooms: ReadonlyMap<string, string>
  readonly doors: Interior['doors']
  readonly furniture: readonly Furniture[]
  /** By anchor id. */
  readonly anchorRoom: ReadonlyMap<string, string>
  readonly stashAnchorId?: string
  readonly forSale?: number
  readonly npcs: readonly SummaryNpc[]
  /** What is lying about in it. What somebody has in their pocket is not: it is in `carried`. */
  readonly items: readonly SummaryItem[]
  /** By item id: whoever has it in their pocket. */
  readonly carried: ReadonlyMap<string, string>
}

/** What a building is, wherever it is read from. */
interface Frontage {
  readonly plotId: string
  readonly kind: Word
  readonly name: string
  readonly districtId?: string
  readonly door: { readonly x: number; readonly z: number }
  readonly work?: readonly WorkKind[]
}

/**
 * The abstract world a quest writer reads: what the town is about, its places,
 * who is in them, what is there, where its door is and what a thing can be left
 * on. No coordinates beyond the door, because that is all a quest ever needs to
 * measure a walk.
 *
 * This is the finished city, which is what a growth writes its work against.
 * A city being built for the first time is read off its plan instead, by
 * `planSummary`, because its work is written before anybody is.
 */
export function summarise(world: World, premise?: Premise): WorldSummary {
  const carried = new Map<string, string>()
  for (const placement of world.placements()) if (placement.at === 'npc') carried.set(placement.itemId, placement.npcId)

  return town(world, premise, () =>
    world.plots().map((plot) => {
      const interior = world.interiors().find((one) => one.plotId === plot.id)
      return [
        {
          plotId: plot.id,
          kind: plot.kind,
          name: plot.name,
          ...(plot.district ? { districtId: plot.district } : {}),
          door: cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, world.cellSize),
          ...(world.charter(plot.kind) ? { work: world.charter(plot.kind)!.work } : {}),
        },
        interior ? standingIn(world, interior, carried) : undefined,
      ] as const
    }),
  )
}

/**
 * The same world read off the plan it is about to be built from: real ids,
 * placeholder names.
 *
 * The town's work is written here, before a person has been written or a sign
 * hung, so what a quest points at is a post the plan cut rather than somebody
 * who was invented first and given a job afterwards. Every id in it is the id
 * the finished city carries.
 */
export function planSummary(world: World, planned: readonly PlannedSite[], plots: ReadonlyMap<number, string>, premise?: Premise): WorldSummary {
  return town(world, premise, () =>
    planned.flatMap((one) => {
      const plotId = plots.get(one.index)
      if (!plotId) return []
      const frontage: Frontage = {
        plotId,
        kind: one.charter.word,
        name: one.standing?.name ?? instanceName(one.index),
        ...(one.district ? { districtId: one.district } : {}),
        door: cellCentre(one.site.entrance.x, one.site.entrance.y, world.cellSize),
        work: one.charter.work,
      }
      return [[frontage, one.inside ? standingInPlan(one) : undefined] as const]
    }),
  )
}

/** The city round the places: what it is called, what it is about and what its parts are. */
function town(world: World, premise: Premise | undefined, places: () => ReadonlyArray<readonly [Frontage, Standing | undefined]>): WorldSummary {
  const asks = world.asks()
  return {
    cityName: world.name,
    theme: world.theme,
    ...(premise ? { premise } : {}),
    ...(asks ? { asks } : {}),
    districts: world.districts().map((district) => ({ districtId: district.id, name: district.name })),
    places: places().map(([frontage, inside]) => placeOf(frontage, inside)),
  }
}

function placeOf(frontage: Frontage, inside: Standing | undefined): Place {
  if (!inside) return { ...frontage, npcs: [], items: [] }
  return {
    ...frontage,
    interiorId: inside.interiorId,
    ...(inside.stashAnchorId ? { stashAnchorId: inside.stashAnchorId } : {}),
    ...(inside.forSale !== undefined ? { forSale: inside.forSale } : {}),
    locks: locksOf(inside),
    machines: machinesOf(inside),
    npcs: inside.npcs,
    items: inside.items,
  }
}

/** One finished building, read off the world file. */
function standingIn(world: World, interior: Interior, carried: ReadonlyMap<string, string>): Standing {
  const anchorRoom = new Map(interior.anchors.map((anchor) => [anchor.id, anchor.roomId]))
  const items: SummaryItem[] = []
  for (const placement of world.placements()) {
    if (placement.at !== 'anchor' || placement.interiorId !== interior.id) continue
    const item = world.item(placement.itemId)
    if (!item) continue
    const roomId = anchorRoom.get(placement.anchorId)
    items.push({
      itemId: item.id,
      name: item.name,
      ...(item.archetype ? { archetype: item.archetype } : {}),
      ...(item.ownerNpcId ? { ownerNpcId: item.ownerNpcId } : {}),
      value: item.value,
      ...(roomId ? { roomId } : {}),
    })
  }
  const surface = surfacesOf(interior.anchors)[0]
  return {
    interiorId: interior.id,
    rooms: new Map(interior.rooms.map((room) => [room.id, room.name])),
    doors: interior.doors,
    furniture: interior.furniture,
    anchorRoom,
    ...(surface ? { stashAnchorId: surface.id } : {}),
    ...(interior.forSale !== undefined ? { forSale: interior.forSale } : {}),
    carried,
    npcs: world
      .npcs()
      .filter((npc) => npc.station?.interiorId === interior.id)
      .map((npc) => {
        const roomId = npc.station ? anchorRoom.get(npc.station.anchorId) : undefined
        return { npcId: npc.id, name: npc.name, role: npc.role, ...(roomId ? { roomId } : {}) }
      }),
    items,
  }
}

/** One planned building, read off the plan: everybody at their post and everything on its surface, all still unnamed. */
function standingInPlan(one: PlannedSite): Standing {
  const inside = one.inside!
  const anchorRoom = new Map(inside.plan.anchors.map((anchor) => [anchor.id, anchor.roomId]))
  const carried = new Map<string, string>()
  const items: SummaryItem[] = []
  for (const thing of inside.things) {
    const pocket = thing.carried ? thing.ownerNpcId : undefined
    if (pocket) {
      carried.set(thing.itemId, pocket)
      continue
    }
    const roomId = anchorRoom.get(thing.anchorId)
    items.push({
      itemId: thing.itemId,
      name: thingName(thing.index),
      archetype: thing.archetype,
      ...(thing.ownerNpcId ? { ownerNpcId: thing.ownerNpcId } : {}),
      value: thing.value,
      ...(roomId ? { roomId } : {}),
    })
  }
  const surface = surfacesOf(inside.plan.anchors)[0]
  return {
    interiorId: inside.interiorId,
    rooms: new Map(inside.plan.rooms.map((room) => [room.id, room.name])),
    doors: inside.plan.doors,
    furniture: inside.plan.furniture,
    anchorRoom,
    ...(surface ? { stashAnchorId: surface.id } : {}),
    ...(inside.forSale !== undefined ? { forSale: inside.forSale } : {}),
    carried,
    npcs: inside.posts.map((post) => ({
      npcId: post.npcId,
      name: personName(post.index),
      role: post.role,
      ...(anchorRoom.get(post.anchor.id) ? { roomId: anchorRoom.get(post.anchor.id)! } : {}),
    })),
    items,
  }
}

/** Every locked door of a place: what opens it, who has that in their pocket, and what is lying behind it. */
function locksOf(inside: Standing): SummaryLock[] {
  return inside.doors
    .filter((door) => door.locked)
    .map((door) => {
      const street = door.from === 'outside'
      const keeper = door.keyItemId ? inside.carried.get(door.keyItemId) : undefined
      return {
        doorId: door.id,
        room: inside.rooms.get(door.to) ?? door.to,
        roomId: door.to,
        street,
        ...(door.keyItemId ? { keyItemId: door.keyItemId } : {}),
        ...(keeper ? { keeperNpcId: keeper } : {}),
        ...(door.password ? { password: door.password } : {}),
        behind: inside.items.filter((item) => street || item.roomId === door.to).map((item) => item.itemId),
      }
    })
}

/** Every screen of a place: what it runs and what opens it. */
function machinesOf(inside: Standing): SummaryMachine[] {
  return inside.furniture.flatMap((piece) =>
    piece.machine
      ? [{ machineId: piece.machine.id, program: piece.machine.program, locked: piece.machine.locked, ...(piece.machine.password ? { password: piece.machine.password } : {}), roomId: piece.roomId }]
      : [],
  )
}
