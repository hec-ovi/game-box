/**
 * A room read as four walls.
 *
 * Every room is a rectangle, and `@gb/scene` stands a wall on each of its
 * edges, `METRICS.building.wallThickness` thick and centred on the edge, with a
 * hole cut for each doorway. So the face a body sees is half a wall inside the
 * rectangle, and that is the plane a bay stands on.
 *
 * What comes out of here is arithmetic on the world document and nothing else:
 * the run, the doorways no bay may touch, and the furniture standing in front
 * of it. No geometry, so it can be checked without building anything.
 */
import { METRICS, footprintOf, roomUseOf, type Interior, type ResolvedCharter, type RoomUse } from '@gb/world'
import { WALL } from './bays.ts'

type Room = Interior['rooms'][number]
type Furniture = Interior['furniture'][number]

export type Side = 'north' | 'south' | 'east' | 'west'

export const SIDES: readonly Side[] = ['north', 'south', 'east', 'west']

/** A stretch of a run, in metres along its own axis. */
export interface Span {
  readonly from: number
  readonly to: number
}

/** Something standing in front of a wall, and how far in front of it. */
export interface Obstacle extends Span {
  /** Metres between the face of the wall and the near edge of the piece. */
  readonly near: number
  /** Metres off the floor of the top of the piece. */
  readonly top: number
}

export interface WallRun {
  readonly roomId: string
  readonly side: Side
  /**
   * Where the face stands on the axis the wall does not run along: z for a
   * north or south wall, x for an east or west one.
   */
  readonly face: number
  /** The run itself, along its own axis, the corners already taken off. */
  readonly from: number
  readonly to: number
  /** True when the other side of this wall is the street. */
  readonly outside: boolean
  /** Doorways, widened by the reveal a bay leaves. No bay may touch one. */
  readonly openings: readonly Span[]
  readonly obstacles: readonly Obstacle[]
}

const HALF_WALL = METRICS.building.wallThickness / 2

/** Half a doorway as `@gb/scene` cuts it, plus the reveal a bay leaves either side. */
const DOORWAY = METRICS.building.doorWidth / 2 + 0.1
const DOORWAY_CLEAR = 0.15

/** Nothing standing further into the room than this is any concern of the wall's. */
const REACH = 2

/** Two floats out of the same generator are the same edge inside this. */
const SAME = 1e-6

/** How much air a bay wants between itself and the piece of furniture in front. */
const OBSTACLE_GAP = 0.02

/** How tall a piece of furniture stands, measured off what was built. */
export type TopOf = (prop: Furniture['prop']) => number

interface Edge {
  readonly face: number
  readonly from: number
  readonly to: number
  /** The rectangle edge itself, which is where a door on this wall sits. */
  readonly line: number
  readonly outside: boolean
  /** +1 when the room is on the high side of the wall, -1 when it is on the low side. */
  readonly inward: number
  readonly along: 'x' | 'y'
}

/** Which routine dressed a room: what the file says, or what its charter asks for when the file left it out. */
export function useOf(room: Room, charter: ResolvedCharter | undefined): RoomUse | undefined {
  return room.use ?? (charter && roomUseOf(room, charter))
}

/** The four walls of one room, ready to be divided into bays. */
export function runsOf(interior: Interior, room: Room, topOf: TopOf): WallRun[] {
  const { x, y, w, h } = room.rect
  const edges: Record<Side, Edge> = {
    north: { face: y + HALF_WALL, from: x, to: x + w, line: y, outside: same(y, 0), inward: 1, along: 'x' },
    south: { face: y + h - HALF_WALL, from: x, to: x + w, line: y + h, outside: same(y + h, interior.size.h), inward: -1, along: 'x' },
    west: { face: x + HALF_WALL, from: y, to: y + h, line: x, outside: same(x, 0), inward: 1, along: 'y' },
    east: { face: x + w - HALF_WALL, from: y, to: y + h, line: x + w, outside: same(x + w, interior.size.w), inward: -1, along: 'y' },
  }

  return SIDES.map((side) => {
    const edge = edges[side]
    return {
      roomId: room.id,
      side,
      face: edge.face,
      // the wall on each end of this one takes half its thickness out of the run
      from: edge.from + HALF_WALL,
      to: edge.to - HALF_WALL,
      outside: edge.outside,
      openings: openingsOn(interior, edge),
      obstacles: obstaclesOn(interior, room, edge, topOf),
    }
  })
}

function openingsOn(interior: Interior, edge: Edge): Span[] {
  const across = edge.along === 'x' ? 'y' : 'x'
  const clear = DOORWAY + DOORWAY_CLEAR
  return interior.doors
    .filter((door) => same(door.pos[across], edge.line) && door.pos[edge.along] > edge.from && door.pos[edge.along] < edge.to)
    .map((door) => ({ from: door.pos[edge.along] - clear, to: door.pos[edge.along] + clear }))
    .sort((one, two) => one.from - two.from)
}

/**
 * The furniture of this room standing close enough to this wall to fight a bay
 * on it, as a stretch of the run and a height.
 *
 * A piece is taken as the box around it: it may stand turned, and a bay only
 * cares how wide a stretch of wall it covers and how tall it is, never which
 * way it faces.
 */
function obstaclesOn(interior: Interior, room: Room, edge: Edge, topOf: TopOf): Obstacle[] {
  const across = edge.along === 'x' ? 'y' : 'x'
  const obstacles: Obstacle[] = []

  for (const piece of interior.furniture) {
    if (piece.roomId !== room.id) continue
    // a piece hung over the field, a camera under the ceiling, fights nothing on it
    if ((piece.lift ?? 0) >= WALL.rail.top) continue
    const half = halfExtents(piece)
    const near = edge.inward * (piece.pos[across] - edge.inward * half[across] - edge.face)
    if (near > REACH) continue

    obstacles.push({
      from: piece.pos[edge.along] - half[edge.along],
      to: piece.pos[edge.along] + half[edge.along],
      near: Math.max(0, near),
      top: (piece.lift ?? 0) + topOf(piece.prop),
    })
  }
  return obstacles
}

/** The box around a piece standing at its own angle, in interior metres. */
function halfExtents(piece: Furniture): { x: number; y: number } {
  const { width, depth } = footprintOf(piece.prop)
  const turn = (-piece.rot * Math.PI) / 180
  const across = Math.abs(Math.cos(turn))
  const down = Math.abs(Math.sin(turn))
  return {
    x: (width / 2) * across + (depth / 2) * down,
    y: (width / 2) * down + (depth / 2) * across,
  }
}

/** Whether a bay of this reach, whose lowest part is at `low`, clears what is in front of it. */
export function clears(run: WallRun, span: Span, depth: number, low: number): boolean {
  for (const obstacle of run.obstacles) {
    if (obstacle.to <= span.from + SAME || obstacle.from >= span.to - SAME) continue
    if (obstacle.near >= depth + OBSTACLE_GAP) continue
    if (obstacle.top > low) return false
  }
  return true
}

/** Whether the floor in front of a stretch of wall is open for `metres` out, with nothing a body walks round on it. */
export function openInFront(run: WallRun, span: Span, metres: number): boolean {
  return run.obstacles.every(
    (obstacle) =>
      obstacle.to <= span.from + SAME || obstacle.from >= span.to - SAME || obstacle.near >= metres || obstacle.top <= STEP_OVER,
  )
}

/** What a body steps over rather than walks round: a rug, a tile. `@gb/scene`'s own number. */
const STEP_OVER = 0.25

/** The stretches of a run no doorway falls in, in order. */
export function segmentsOf(run: WallRun): Span[] {
  const segments: Span[] = []
  let at = run.from
  for (const door of run.openings) {
    if (door.from > at) segments.push({ from: at, to: Math.min(door.from, run.to) })
    at = Math.max(at, door.to)
  }
  if (at < run.to) segments.push({ from: at, to: run.to })
  return segments.filter((span) => span.to - span.from > SAME)
}

function same(one: number, two: number): boolean {
  return Math.abs(one - two) < 1e-4
}
