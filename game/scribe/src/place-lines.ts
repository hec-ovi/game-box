import type { WorldSummary } from '@gb/forge'
import { lockOn } from './locks.ts'

type Place = WorldSummary['places'][number]
type Lock = NonNullable<Place['locks']>[number]
type Machine = NonNullable<Place['machines']>[number]

/** What a screen does, in the words a quest writer reads. */
const RUNS: Record<Machine['program'], string> = {
  ledger: 'holds the ledger',
  'camera-feed': 'shows the camera feed',
  mail: 'holds the mail',
  snake: 'runs snake',
  tetris: 'runs tetris',
  blank: 'a blank desk screen',
}

/**
 * One place written out for the quest writer, indented under its own heading:
 * who is in it and where they stand, what is lying about with its price and its
 * seller, which doors are locked and what opens each, which screens are on and
 * what opens those, and what the place itself sells for. Every id a step could
 * name is here, and everything that stands behind a lock says so, because a
 * writer who cannot see the lock writes a job the harness reports shut.
 */
export function placeLines(place: Place): readonly string[] {
  const people =
    place.npcs.map((npc) => `${npc.name} (${npc.role}, ${npc.npcId}${behind(lockOn(place, npc.roomId))})`).join('; ') ||
    'nobody'
  const things =
    place.items
      .map((item) => {
        const seller = item.ownerNpcId ? `, owned by ${item.ownerNpcId}` : ''
        const price = item.value !== undefined && item.ownerNpcId ? `, sells for ${item.value}` : ''
        return `${item.name} (${item.itemId}${seller}${price}${behind(lockOn(place, item.roomId, item.itemId))})`
      })
      .join('; ') || 'nothing'
  return [
    `    people: ${people}`,
    `    things: ${things}`,
    ...(place.locks?.length ? [`    locked doors: ${place.locks.map((lock) => doorLine(place, lock)).join('; ')}`] : []),
    ...(place.machines?.length ? [`    screens: ${place.machines.map((machine) => screenLine(place, machine)).join('; ')}`] : []),
    ...(place.forSale !== undefined && place.interiorId
      ? [`    for sale: ${place.forSale} credits, its deed on a counter somewhere in town; a deed reward names ${place.interiorId}`]
      : []),
  ]
}

function behind(lock: Lock | undefined): string {
  return lock ? `, behind the locked ${lock.room} door ${lock.doorId}` : ''
}

function doorLine(place: Place, lock: Lock): string {
  const keeper = place.npcs.find((npc) => npc.npcId === lock.keeperNpcId)
  const ways: string[] = []
  if (lock.keyItemId) {
    ways.push(`the key ${lock.keyItemId} in ${keeper ? `${keeper.name}'s` : `${lock.keeperNpcId ?? 'its keeper'}'s`} pocket${keeper ? ` (${keeper.npcId})` : ''}`)
  }
  if (lock.password) ways.push(`the code "${lock.password}"`)
  const where = lock.street ? 'the street door, the whole place behind it' : `the ${lock.room} door`
  return `${lock.doorId}, ${where}, opened by ${ways.join(' or ') || 'nothing'}`
}

function screenLine(place: Place, machine: Machine): string {
  const lock = machine.locked ? `locked, code "${machine.password}"` : 'open to anybody'
  return `${machine.machineId} ${RUNS[machine.program]}, ${lock}${behind(lockOn(place, machine.roomId))}`
}
