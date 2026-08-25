import type { Rng } from '@gb/kit'
import type { Anchor, BuildingKind, Furniture, Interior, Room } from '@gb/world'
import { hangDoors } from './doors.ts'
import { furnishRoom, type RoomWants } from './furnish/index.ts'
import { step, type Side, type Vec } from './geometry.ts'
import { cutRooms } from './rooms.ts'
import { RoomPlan, type Mint } from './room-plan.ts'

export interface InteriorPlan {
  readonly rooms: Room[]
  readonly doors: Interior['doors']
  readonly furniture: Furniture[]
  readonly anchors: Anchor[]
}

export interface InteriorRequest {
  readonly kind: BuildingKind
  readonly size: { readonly w: number; readonly h: number }
  /** The wall the street door is in. */
  readonly entrance: Side
  /** What the town asks of the rooms beyond what the kind says. */
  readonly wants: RoomWants
  readonly mint: Mint
  readonly rng: Rng
}

/** Buildings where somebody is always on duty, whatever the dice say. */
const STAFFED: readonly BuildingKind[] = [
  'bar',
  'cafe',
  'restaurant',
  'shop',
  'market',
  'workshop',
  'clinic',
  'hotel',
  'station',
  'office',
]

/**
 * Plans one interior end to end: rooms first, then the doors that string them
 * together, then the furniture and the places people stand. Nothing lands
 * anywhere a person could not walk to, and every building keeps its service post.
 */
export function planInterior(request: InteriorRequest): InteriorPlan {
  const { kind, size, entrance, wants, mint, rng } = request
  const boxes = cutRooms(kind, size, entrance, rng)
  const rooms: Room[] = boxes.map((box) => ({ id: mint('room'), kind: box.kind, name: box.name, rect: box.rect }))
  const { doors, points } = hangDoors(rooms, entrance, mint, rng)

  const roles = new Map(rooms.map((room, index) => [room.id, boxes[index]!.role]))
  const reachable = rooms.filter((room) => (points.get(room.id) ?? []).length > 0)
  const plans = reachable.map((room, index) => {
    const plan = new RoomPlan(room, points.get(room.id) ?? [], mint, rng.fork(`room/${index}`))
    furnishRoom(plan, kind, roles.get(room.id)!, wants)
    return plan
  })

  const entry = plans[0]!
  if (STAFFED.includes(kind) && !plans.some((plan) => plan.anchors.some((anchor) => anchor.kind === 'serve'))) {
    stationSomeone(entry, 'serve')
  }
  if (!plans.some((plan) => plan.anchors.length > 0)) stationSomeone(entry, 'stand')

  return {
    rooms: reachable,
    doors,
    furniture: plans.flatMap((plan) => [...plan.furniture]),
    anchors: plans.flatMap((plan) => [...plan.anchors]),
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
