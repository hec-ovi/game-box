import type { Rng } from '@gb/kit'
import type { Interior, Room } from '@gb/world'
import {
  boxAt,
  centreOf,
  clamp,
  onWall,
  outward,
  round,
  sharedWall,
  wallOf,
  type Side,
  type Vec,
} from './geometry.ts'
import type { DoorPoint, Mint } from './room-plan.ts'

type Door = Interior['doors'][number]

/** A doorway keeps this much floor to itself: across the opening, and either side of the wall. */
const ZONE_WIDTH = 1.2
const ZONE_DEPTH = 2

/** How far inside a room you stand once you are through the door. */
const INNER = 0.6

export interface Doorways {
  readonly doors: Door[]
  /** Per room, the doorways that open into it. */
  readonly points: Map<string, DoorPoint[]>
}

/**
 * Hangs the doors: one from the street into the entry room, then one from room to
 * room until every room is reachable, each on a wall the two rooms actually share.
 */
export function hangDoors(rooms: readonly Room[], entrance: Side, mint: Mint, rng: Rng): Doorways {
  const entry = rooms[0]!
  const doors: Door[] = []
  const points = new Map<string, DoorPoint[]>(rooms.map((room) => [room.id, []]))

  const wall = wallOf(entry.rect, entrance)
  const span = wall.to - wall.from
  const at = clamp(
    (wall.from + wall.to) / 2 + rng.range(-0.2, 0.2) * span,
    wall.from + ZONE_WIDTH / 2 + 0.2,
    wall.to - ZONE_WIDTH / 2 - 0.2,
  )
  const pos = onWall(wall, at, 0)
  const inward = round((outward(entrance) + 180) % 360)
  doors.push({ id: mint('door'), from: 'outside', to: entry.id, pos, rot: outward(entrance), locked: false })
  points.get(entry.id)!.push({
    pos,
    inner: onWall(wall, at, INNER),
    zone: boxAt(pos, { w: ZONE_WIDTH, d: ZONE_DEPTH }, inward),
  })

  const depth = new Map([[entry.id, 0]])
  const waiting = rooms.slice(1)
  while (waiting.length) {
    const next = pickJoin(waiting, rooms, depth)
    if (!next) break
    waiting.splice(waiting.indexOf(next.room), 1)
    depth.set(next.room.id, (depth.get(next.from.id) ?? 0) + 1)
    doors.push(...join(next.from, next.room, mint, rng, points))
  }
  return { doors, points }
}

interface Join {
  readonly room: Room
  readonly from: Room
  readonly overlap: number
  readonly depth: number
}

/**
 * The next room to hang a door onto. Rooms hang off the entrance before they
 * hang off each other, so nobody has to walk through a bedroom to reach the
 * kitchen; ties go to the widest shared wall.
 */
function pickJoin(waiting: readonly Room[], rooms: readonly Room[], depth: ReadonlyMap<string, number>): Join | undefined {
  let best: Join | undefined
  for (const room of waiting) {
    for (const other of rooms) {
      const from = depth.get(other.id)
      if (from === undefined) continue
      const shared = sharedWall(other.rect, room.rect)
      if (!shared) continue
      const overlap = shared.to - shared.from
      if (overlap < 1.4) continue
      const better = !best || from < best.depth || (from === best.depth && overlap > best.overlap)
      if (better) best = { room, from: other, overlap, depth: from }
    }
  }
  return best
}

function join(from: Room, to: Room, mint: Mint, rng: Rng, points: Map<string, DoorPoint[]>): Door[] {
  const shared = sharedWall(from.rect, to.rect)
  if (!shared) return []
  const at = clamp(
    (shared.from + shared.to) / 2 + rng.range(-0.25, 0.25) * (shared.to - shared.from),
    shared.from + ZONE_WIDTH / 2 + 0.15,
    shared.to - ZONE_WIDTH / 2 - 0.15,
  )
  const pos: Vec =
    shared.axis === 'x' ? { x: round(shared.at), y: round(at) } : { x: round(at), y: round(shared.at) }
  const target = centreOf(to.rect)
  const rot =
    shared.axis === 'x' ? (target.x > shared.at ? 90 : 270) : target.y > shared.at ? 180 : 0
  const zone = boxAt(pos, { w: ZONE_WIDTH, d: ZONE_DEPTH }, rot)

  for (const [room, sign] of [
    [to, 1],
    [from, -1],
  ] as const) {
    const inner: Vec =
      shared.axis === 'x'
        ? { x: round(pos.x + sign * INNER * (rot === 90 ? 1 : -1)), y: pos.y }
        : { x: pos.x, y: round(pos.y + sign * INNER * (rot === 180 ? 1 : -1)) }
    points.get(room.id)!.push({ pos, inner, zone })
  }

  return [{ id: mint('door'), from: from.id, to: to.id, pos, rot, locked: false }]
}
