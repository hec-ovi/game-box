import type { WorldDoc } from '../model/schema.ts'
import { PLAYER } from '../model/access.ts'
import type { Report } from './report.ts'

/**
 * Every way past a lock names something the file holds, and every lock has a
 * way past it: a key item on the door, a password, or a key or card somewhere
 * in the world that opens the door or the interior it is the street door of.
 */
export function checkAccess(doc: WorldDoc, report: Report): void {
  const interiors = new Set(doc.interiors.map((i) => i.id))
  const npcs = new Set(doc.npcs.map((n) => n.id))
  const items = new Set(doc.items.map((i) => i.id))
  const doors = new Set(doc.interiors.flatMap((i) => i.doors.map((d) => d.id)))
  const openedDoors = new Set<string>()
  const openedInteriors = new Set<string>()

  for (const item of doc.items) {
    const where = `item ${item.id}`
    if (item.deedTo && !interiors.has(item.deedTo)) report.fail(where, `is a deed to unknown interior ${item.deedTo}`)
    if (!item.opens) continue
    if ('doorId' in item.opens) {
      if (doors.has(item.opens.doorId)) openedDoors.add(item.opens.doorId)
      else report.fail(where, `opens unknown door ${item.opens.doorId}`)
    } else if (interiors.has(item.opens.interiorId)) openedInteriors.add(item.opens.interiorId)
    else report.fail(where, `opens unknown interior ${item.opens.interiorId}`)
  }

  for (const interior of doc.interiors) {
    const where = `interior ${interior.id}`
    if (interior.owner && interior.owner !== PLAYER && !npcs.has(interior.owner)) {
      report.fail(where, `owner ${interior.owner} does not exist`)
    }
    for (const door of interior.doors) {
      if (door.keyItemId && !items.has(door.keyItemId)) report.fail(where, `door ${door.id} needs unknown key ${door.keyItemId}`)
      if (!door.locked) continue
      const street = door.from === 'outside' && openedInteriors.has(interior.id)
      const opened = door.keyItemId || door.password || openedDoors.has(door.id) || street
      if (!opened) report.fail(where, `door ${door.id} is locked with nothing that opens it`)
    }
  }
}
