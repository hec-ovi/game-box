import type { AnchorKind, Interior } from '@gb/world'
import type { PropFootprint } from './footprint.ts'

/** The square a visitor stands in, in metres: a body and its elbows. */
export const VISITOR_CELL = 1

/** Half a body across: what has to be clear round the middle of a cell for someone to stand in it. */
const BODY_RADIUS = 0.35

/** Metres from a door nobody stands within, so the way in and out stays open. */
const DOOR_CLEAR = 1.5

/** How wide the strip the staff move along behind their piece is. */
const AISLE = 1

/** The stances that are a job at a piece of furniture: the floor behind that piece is theirs. */
const STAFF_KINDS: ReadonlySet<AnchorKind> = new Set<AnchorKind>(['serve', 'cook', 'work-desk', 'work-bench'])

/** One square of floor a visitor may stand on: its middle, in interior metres, and the room it is in. */
export interface VisitorCell {
  readonly x: number
  readonly z: number
  readonly roomId: string
}

/**
 * Where a visitor may stand: every `VISITOR_CELL` square of a room's floor
 * that is clear of the furniture a body cannot walk through, clear of the
 * doors, not somebody's own spot, and not on the aisle the staff work along
 * behind their counter, desk or stove. Nearest the street door first, so a
 * companion coming in stands by the door rather than across the room.
 */
export function visitorCellsOf(interior: Interior, blockers: readonly PropFootprint[], footprints: ReadonlyMap<string, PropFootprint>): VisitorCell[] {
  const aisles = interior.anchors
    .filter((anchor) => STAFF_KINDS.has(anchor.kind))
    .flatMap((anchor) => {
      const piece = anchor.propId ? footprints.get(anchor.propId) : undefined
      return piece ? [aisleOf(piece, anchor.pos)] : []
    })
  const door = interior.doors.find((one) => one.from === 'outside') ?? interior.doors[0]

  const cells: VisitorCell[] = []
  for (const room of interior.rooms) {
    const across = Math.floor(room.rect.w / VISITOR_CELL)
    const deep = Math.floor(room.rect.h / VISITOR_CELL)
    for (let row = 0; row < deep; row++) {
      for (let column = 0; column < across; column++) {
        const x = room.rect.x + (column + 0.5) * VISITOR_CELL
        const z = room.rect.y + (row + 0.5) * VISITOR_CELL
        if (blockers.some((piece) => piece.contains(x, z, BODY_RADIUS))) continue
        if (interior.doors.some((one) => Math.hypot(one.pos.x - x, one.pos.y - z) < DOOR_CLEAR)) continue
        if (interior.anchors.some((one) => Math.hypot(one.pos.x - x, one.pos.y - z) < BODY_RADIUS * 2)) continue
        if (aisles.some((aisle) => aisle(x, z))) continue
        cells.push({ x, z, roomId: room.id })
      }
    }
  }

  if (door) {
    const from = { x: door.pos.x, z: door.pos.y }
    cells.sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z) || a.x - b.x || a.z - b.z)
  }
  return cells
}

/**
 * The strip of floor the staff work along: `AISLE` deep on the side of the
 * piece their anchor stands, the whole length of the piece and a step past
 * either end. Answers whether a point is on it.
 */
function aisleOf(piece: PropFootprint, stands: { x: number; y: number }): (x: number, z: number) => boolean {
  const side = Math.sign(piece.local(stands.x, stands.y).through) || 1
  const near = piece.halfDepth
  const far = piece.halfDepth + AISLE
  const reach = piece.halfWidth + AISLE / 2
  return (x, z) => {
    const local = piece.local(x, z)
    const through = local.through * side
    return Math.abs(local.along) <= reach + BODY_RADIUS && through >= near - BODY_RADIUS && through <= far + BODY_RADIUS
  }
}
