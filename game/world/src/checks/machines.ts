import type { WorldDoc } from '../model/schema.ts'
import type { Report } from './report.ts'

/**
 * A machine's id is taken once, a camera watches a room of its own interior,
 * and a bars-door stands across a door of its own interior.
 */
export function checkMachines(doc: WorldDoc, report: Report): void {
  for (const interior of doc.interiors) {
    const where = `interior ${interior.id}`
    const rooms = new Set(interior.rooms.map((r) => r.id))
    const doors = new Set(interior.doors.map((d) => d.id))
    for (const piece of interior.furniture) {
      if (piece.machine) report.claim(`${where} machine`, piece.machine.id)
      if (piece.watches && !rooms.has(piece.watches)) report.fail(where, `camera ${piece.id} watches unknown room ${piece.watches}`)
      if (piece.doorId && !doors.has(piece.doorId)) report.fail(where, `bars-door ${piece.id} stands across unknown door ${piece.doorId}`)
    }
  }
}
