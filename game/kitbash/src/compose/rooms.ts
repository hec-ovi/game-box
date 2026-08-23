import type { Rng } from '@gb/kit'
import type { Room } from '../night/room.ts'
import type { Band } from './bands.ts'
import type { Face } from './faces.ts'

/** A room runs across one to three modules, so neighbours share an interior. */
const WIDEST = 3

/** Floor and ceiling take this much off the storey, so a room is not the whole band. */
const SLAB = 0.6

/**
 * Cuts one storey of one wall into rooms, and answers which room each module
 * looks into. A run of modules shares a room, which is what makes a group of
 * windows light up together and show the same furniture from two angles.
 *
 * Every module gets an answer, glazed or not: whether a piece has a pane in it
 * is the caller's business, and a solid module standing between two windows of
 * the same room is a pier, not a wall between two flats.
 */
export function roomsAcross(face: Face, band: Band, rng: Rng): Room[] {
  const rooms: Room[] = []
  const centreY = band.base + band.height / 2
  const height = Math.max(1.6, band.height - SLAB)

  for (let first = 0; first < face.modules;) {
    const span = Math.min(rng.int(1, WIDEST + 1), face.modules - first)
    const [fromX, fromZ] = face.centreOf(first)
    const [toX, toZ] = face.centreOf(first + span - 1)
    const room: Room = {
      centre: [(fromX + toX) / 2, centreY, (fromZ + toZ) / 2],
      size: [span * face.moduleWidth, height],
      key: rng.float(),
      look: [rng.float(), rng.float()],
    }
    for (let at = 0; at < span; at++) rooms.push(room)
    first += span
  }
  return rooms
}
