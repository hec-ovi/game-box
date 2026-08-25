import type { ScreenProgram } from '@gb/hud'
import type { Furniture, Interior, Machine, World } from '@gb/world'

/**
 * What a screen is running, in the city's own words. The file says which
 * program a machine runs; everything on the glass is read off the city around
 * it, so a ledger lists what that place really has on its shelves and a camera
 * feed names the rooms its cameras really watch. Nothing here is invented and
 * nothing is kept: the page is built from the world each time it is opened.
 */
export function programOf(world: World, interior: Interior, machine: Machine, best?: number): ScreenProgram {
  if (machine.program === 'snake' || machine.program === 'tetris') {
    return best === undefined ? { kind: machine.program } : { kind: machine.program, best }
  }
  if (machine.program === 'ledger') return { kind: 'text', title: 'Ledger', lines: stock(world, interior) }
  if (machine.program === 'mail') return { kind: 'text', title: 'Mail', lines: mail(world, interior) }
  if (machine.program === 'camera-feed') return { kind: 'text', title: 'Cameras', lines: feed(world, interior) }
  return { kind: 'text', title: 'System', lines: ['No program is installed on this machine.'] }
}

/** What the place has standing on its own shelves and counters, and what it is worth. */
function stock(world: World, interior: Interior): string[] {
  const lines: string[] = []
  let total = 0
  for (const placement of world.placements()) {
    if (placement.at !== 'anchor' || placement.interiorId !== interior.id) continue
    const item = world.item(placement.itemId)
    if (!item) continue
    total += item.value ?? 0
    lines.push(`${item.name}   ${item.value ?? 0} credits`)
  }
  if (lines.length === 0) return ['Nothing on the books.']
  lines.push('', `Total   ${total} credits`)
  return lines
}

/** A line from everybody who works here, in the words the city gave them. */
function mail(world: World, interior: Interior): string[] {
  const lines = world
    .npcs()
    .filter((npc) => npc.station?.interiorId === interior.id)
    .map((npc) => `${npc.name}   ${npc.knowledge?.[0] ?? npc.role}`)
  return lines.length > 0 ? lines : ['No messages.']
}

/** Every camera in the building, the room it watches and who is standing in it. */
function feed(world: World, interior: Interior): string[] {
  const lines = interior.furniture.flatMap((piece) => (piece.prop === 'camera' && piece.watches ? [watched(world, interior, piece)] : []))
  return lines.length > 0 ? lines : ['No camera on this building.']
}

function watched(world: World, interior: Interior, camera: Furniture): string {
  const room = interior.rooms.find((each) => each.id === camera.watches)
  const anchors = new Set(interior.anchors.filter((anchor) => anchor.roomId === camera.watches).map((anchor) => anchor.id))
  const people = world
    .npcs()
    .filter((npc) => npc.station?.interiorId === interior.id && anchors.has(npc.station.anchorId))
    .map((npc) => npc.name)
  return `${room?.name ?? 'Unknown room'}   ${people.length > 0 ? people.join(', ') : 'nobody in sight'}`
}
