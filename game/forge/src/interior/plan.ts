import type { Rng } from '@gb/kit'
import { METRICS, type Anchor, type Charter, type Furniture, type Interior, type Room } from '@gb/world'
import { hangDoors } from './doors.ts'
import { furnishRoom, type RoomWants } from './furnish/index.ts'
import { headingTo, step, type Side, type Vec } from './geometry.ts'
import { barsFor, lockDoors, type PlannedKey } from './locks.ts'
import { keepsWatch, stampMachines } from './machines.ts'
import { programmeOf } from './recipes.ts'
import { cutRooms } from './rooms.ts'
import { RoomPlan, type Mint } from './room-plan.ts'

export interface InteriorPlan {
  readonly rooms: Room[]
  readonly doors: Interior['doors']
  readonly furniture: Furniture[]
  readonly anchors: Anchor[]
  /** The keys and cards its locks name, for whoever keeps them to carry. */
  readonly keys: PlannedKey[]
  /** Rooms behind a locked door: where a thing worth locking up is put. */
  readonly shut: string[]
}

export interface InteriorRequest {
  /** What kind of place this is: its rooms, its service, the work done in it and who it admits. */
  readonly charter: Charter
  readonly size: { readonly w: number; readonly h: number }
  /** The wall the street door is in. */
  readonly entrance: Side
  /** What the town asks of the rooms beyond what the charter says. */
  readonly wants: RoomWants
  /** The id the interior will carry: a card for a private place names it. */
  readonly interiorId: string
  readonly mint: Mint
  readonly rng: Rng
}

/** How high a camera hangs: its top a hand under the ceiling. */
const CAMERA_LIFT = METRICS.building.groundFloorHeight - 0.5

/**
 * Plans one interior end to end: rooms first, then the doors that string them
 * together and the locks the charter puts on them, then the furniture and the
 * places people stand, then what every screen runs. Nothing lands anywhere a
 * person could not walk to, a place with a service keeps its post, and a place
 * that keeps watch has somebody on the door and a camera over it.
 */
export function planInterior(request: InteriorRequest): InteriorPlan {
  const { charter, size, entrance, wants, interiorId, mint, rng } = request
  const boxes = cutRooms(programmeOf(charter), size, entrance, rng)
  const rooms: Room[] = boxes.map((box) => ({ id: mint('room'), kind: box.kind, use: box.use, name: box.name, rect: box.rect }))
  const shut = new Set(rooms.filter((_, at) => boxes[at]!.shut).map((room) => room.id))
  const hung = hangDoors(rooms, entrance, mint, rng)
  const { doors, keys } = lockDoors(hung.doors, rooms, shut, charter, interiorId, mint, rng.fork('locks'))

  const reachable = rooms.filter((room) => (hung.points.get(room.id) ?? []).length > 0)
  const plans = reachable.map((room, index) => {
    const plan = new RoomPlan(room, hung.points.get(room.id) ?? [], mint, rng.fork(`room/${index}`))
    furnishRoom(plan, boxes[rooms.indexOf(room)]!.use, wants)
    return plan
  })

  const entry = plans[0]!
  const has = (kind: Anchor['kind']) => plans.some((plan) => plan.anchors.some((anchor) => anchor.kind === kind))
  if (charter.service !== 'none' && !has('serve')) stationSomeone(entry, 'serve')
  if (charter.work.includes('watch') && !has('guard')) doorman(entry)
  if (!plans.some((plan) => plan.anchors.length > 0)) stationSomeone(entry, 'stand')
  const watched = keepsWatch(charter) && entry.mount('camera', entry.backSide(), CAMERA_LIFT) !== undefined

  const furniture = stampMachines(
    plans.flatMap((plan) => [...plan.furniture]),
    { charter, watched, mint, rng: rng.fork('machines') },
  )
  return {
    rooms: reachable,
    doors,
    furniture: [...furniture, ...barsFor(doors, charter, mint)],
    anchors: plans.flatMap((plan) => [...plan.anchors]),
    keys,
    shut: doors.filter((door) => door.locked && door.from !== 'outside').map((door) => door.to),
  }
}

/** Last resort: somebody standing on open floor, facing the way in. */
function stationSomeone(plan: RoomPlan, kind: 'serve' | 'stand'): void {
  const facing: Vec = plan.doors[0]?.pos ?? step(plan.centre, 0, 1)
  const spots = [plan.centre, ...plan.lattice(plan.bounds, { x: 0.8, y: 0.8 })]
  for (const spot of spots) {
    if (plan.post(kind, spot, facing)) return
  }
}

/** Somebody keeping watch just inside the street door, to one side of it, facing the room. */
function doorman(plan: RoomPlan): void {
  const door = plan.doors[0]
  if (!door) return
  const across = headingTo(door.pos, plan.centre)
  for (const turn of [90, -90]) if (plan.post('guard', step(door.inner, across + turn, 1.2), plan.centre)) return
}
