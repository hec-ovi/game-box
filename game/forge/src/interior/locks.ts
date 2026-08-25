import type { Rng } from '@gb/kit'
import type { Access, Charter, Furniture, Interior, ItemArchetype, Room } from '@gb/world'
import { codeFor } from './codes.ts'
import type { Mint } from './room-plan.ts'

type Door = Interior['doors'][number]

/** A key or a card the plan wrote for a lock: the thing, what it opens, and the room it is the key to. */
export interface PlannedKey {
  readonly itemId: string
  readonly archetype: Extract<ItemArchetype, 'key' | 'keycard'>
  readonly opens: Access
  readonly doorId: string
  /** The room the door opens into, which is what the key is named after. */
  readonly room: string
}

export interface Locked {
  readonly doors: Door[]
  readonly keys: PlannedKey[]
}

/** Finishes whose locked door is a gate of steel bars rather than a plain door: a cell, a cage, a cellar grille. */
const BARRED: ReadonlyArray<Charter['finish']> = ['civic', 'industrial', 'worn']

/** Finishes whose key is a card rather than a cut key. */
const CARDED: ReadonlyArray<Charter['finish']> = ['corporate', 'civic', 'industrial']

/**
 * Locks the doors a charter says are locked, and writes what opens each one.
 *
 * A `private` place locks its street door: the keeper carries a card for the
 * whole interior, and a code is written on the door for a quest to hand out.
 * An `admitted` or `private` place locks every room marked `shut` behind a key
 * (a card where the finish is one that issues cards), and a place that works
 * at desks writes a code beside the key, because an office door has a keypad.
 * An `open` place locks nothing, whatever its rooms are called.
 */
export function lockDoors(doors: readonly Door[], rooms: readonly Room[], shut: ReadonlySet<string>, charter: Charter, interiorId: string, mint: Mint, rng: Rng): Locked {
  if (charter.access === 'open') return { doors: [...doors], keys: [] }
  const keys: PlannedKey[] = []
  const named = new Map(rooms.map((room) => [room.id, room.name]))
  const archetype = CARDED.includes(charter.finish) ? 'keycard' : 'key'
  const locked = doors.map((door): Door => {
    const street = door.from === 'outside'
    if (street ? charter.access !== 'private' : !shut.has(door.to)) return door
    const itemId = mint('item')
    const opens: Access = street ? { interiorId } : { doorId: door.id }
    keys.push({ itemId, archetype: street ? 'keycard' : archetype, opens, doorId: door.id, room: named.get(door.to) ?? 'room' })
    const coded = street || charter.work.includes('desk')
    return { ...door, locked: true, keyItemId: itemId, ...(coded ? { password: codeFor(rng) } : {}) }
  })
  return { doors: locked, keys }
}

/** The steel-bar gates standing across the locked inner doors of a place whose finish has them. */
export function barsFor(doors: readonly Door[], charter: Charter, mint: Mint): Furniture[] {
  if (!BARRED.includes(charter.finish)) return []
  return doors
    .filter((door) => door.locked && door.from !== 'outside')
    .map((door) => ({ id: mint('prop'), prop: 'bars-door', roomId: door.to, pos: { ...door.pos }, rot: door.rot, doorId: door.id }))
}
