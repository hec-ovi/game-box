import type { CharterRoom } from '../model/charter.ts'
import type { ResolvedCharter } from '../model/resolved.ts'
import type { Room } from '../model/schema.ts'
import { ROOM_USES, type RoomUse } from '../model/traits.ts'
import type { RoomKind } from '../model/vocabulary.ts'

/** The label a room of each use is cut as, unless its charter says otherwise. */
export const ROOM_USE_KIND: Record<RoomUse, RoomKind> = {
  'entrance-hall': 'hall',
  'waiting-room': 'hall',
  lobby: 'hall',
  concourse: 'hall',
  taproom: 'main',
  'cafe-floor': 'main',
  'dining-room': 'main',
  'shop-floor': 'main',
  'market-hall': 'main',
  'desk-floor': 'main',
  'private-office': 'office',
  'bench-floor': 'main',
  ward: 'main',
  assembly: 'main',
  'living-room': 'main',
  bedroom: 'bedroom',
  'guest-room': 'bedroom',
  kitchen: 'kitchen',
  washroom: 'bathroom',
  store: 'storage',
  'bulk-store': 'storage',
}

/** The label a charter's room is cut as. */
export const roomKindOf = (spec: CharterRoom): RoomKind => spec.kind ?? ROOM_USE_KIND[spec.use]

/**
 * Which routine dresses a room. A room that carries `use` says so; one from a
 * file written before rooms did is read back off its label through the rooms
 * its charter asks for, hall first, then main, then the services, which is
 * the inverse of how those rooms were cut. A label the charter never asked
 * for takes the first use that cuts to it.
 */
export function roomUseOf(room: Room, charter: ResolvedCharter): RoomUse {
  if (room.use) return room.use
  const { hall, main, services } = charter.rooms
  const asked = [...(hall ? [hall] : []), main, ...services].find((spec) => roomKindOf(spec) === room.kind)
  return asked?.use ?? ROOM_USES.find((use) => ROOM_USE_KIND[use] === room.kind) ?? main.use
}
