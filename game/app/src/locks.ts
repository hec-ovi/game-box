import type { CityNav } from '@gb/nav'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { Access, Door, Interior, World } from '@gb/world'
import type { Reporting } from './reporting.ts'

/**
 * The locks on a city's doors. The file says which doors are locked and what
 * opens them; the playthrough says what the player is carrying, was given and
 * owns; `@gb/nav` keeps the live state, so a route asked for after a lock came
 * off walks through it.
 *
 * Nothing here decides what a lock means: a door opens for a key in hand, a
 * card or an access granted, the word the player was given, or a place that is
 * theirs. What it does is put the three in one place, so the street door, the
 * door inside the room and the gate of bars across it all read the same rule.
 */
export class Locks {
  #world: World
  #player: PlayerState
  #nav: CityNav
  #log: QuestLog
  #report: Reporting

  constructor(input: { world: World; player: PlayerState; nav: CityNav; log: QuestLog; report: Reporting }) {
    this.#world = input.world
    this.#player = input.player
    this.#nav = input.nav
    this.#log = input.log
    this.#report = input.report
  }

  /** The door onto the street, the one the player walks in by. */
  streetDoor(interior: Interior): Door | undefined {
    return interior.doors.find((door) => door.from === 'outside')
  }

  /** Whether that door is standing locked right now: the file's state until something opened it. */
  locked(doorId: string): boolean {
    return this.#nav.locked(doorId) ?? this.#world.door(doorId)?.door.locked ?? false
  }

  /** Whether the player has something that gets them through, without opening it. */
  opens(interiorId: string, door: Door): boolean {
    if (!this.locked(door.id)) return true
    if (this.#player.opens({ doorId: door.id })) return true
    if (door.keyItemId !== undefined && this.#player.has(door.keyItemId)) return true
    if (door.password !== undefined && this.#player.knows(door.password)) return true
    // a place of the player's own opens for them whatever the file says, and so
    // does one whose card or key names the whole interior rather than one door
    if (door.from !== 'outside') return false
    return this.#player.owns(interiorId) || this.#player.opens({ interiorId })
  }

  /**
   * Open it if the player can. The lock comes off for good: the access is
   * written down so it survives a save, `@gb/nav` gets its edge back so a route
   * walks through, and the quest log hears that this door was unlocked.
   * Answers whether the player may go through, so a door that was never locked
   * is a yes that changes nothing.
   */
  open(interiorId: string, door: Door): boolean {
    if (!this.locked(door.id)) return true
    if (!this.opens(interiorId, door)) {
      this.#report.note(`Locked: ${this.#takes(door)}`)
      return false
    }
    // a lock the player took off themselves is written down as access, so the
    // door is open again when the city is built back from its file with every
    // lock on it, whatever they are carrying by then
    this.#player.grant({ doorId: door.id })
    this.#nav.setLocked(door.id, false)
    this.#report.note(this.#opening(door))
    this.#report.report(this.#log.handle({ kind: 'unlocked', doorId: door.id }))
    return true
  }

  /**
   * A word, a key or a door that changed hands in a conversation. A key opens
   * its own door from the pocket it is in; a word opens nothing until it is
   * typed at the door it belongs to.
   */
  handed(grant: { keyItemId: string } | { password: string } | { access: Access }): void {
    if ('access' in grant) {
      this.granted(grant.access)
      return
    }
    if (!('keyItemId' in grant)) return
    const opens = this.#world.item(grant.keyItemId)?.opens
    if (opens) this.granted(opens)
  }


  /** Access that has just changed hands: a card, a word or a door a job opened. */
  granted(access: Access): void {
    if ('doorId' in access) {
      this.#nav.setLocked(access.doorId, false)
      return
    }
    this.#opened(access.interiorId)
  }

  /**
   * What the playthrough already gets past, told to `@gb/nav`. A save carries
   * the keys, the cards and the doors a job opened; the city is built again
   * from its file every time, with every lock back on, so the two are put back
   * together here before the first route is asked for.
   */
  restore(): void {
    for (const key of this.#player.keys()) this.granted(key.opens)
    for (const interiorId of this.#player.owned()) this.#opened(interiorId)
  }

  /** A whole interior opened to the player: its street door, and nothing inside it. */
  #opened(interiorId: string): void {
    const interior = this.#world.interior(interiorId)
    const door = interior ? this.streetDoor(interior) : undefined
    if (door) this.#nav.setLocked(door.id, false)
  }

  /** What gets through this door, in the player's words. */
  #takes(door: Door): string {
    const key = door.keyItemId ? this.#world.item(door.keyItemId) : undefined
    if (key) return `it takes the ${key.name.toLowerCase()}`
    if (door.password !== undefined) return 'it takes a word'
    return 'nothing here opens it'
  }

  /** What opened it, so the player knows which of the things they carry did the work. */
  #opening(door: Door): string {
    const held = door.keyItemId !== undefined && this.#player.has(door.keyItemId) ? door.keyItemId : undefined
    const key = held ? this.#world.item(held) : undefined
    if (key) return `Unlocked with the ${key.name.toLowerCase()}`
    if (door.password !== undefined && this.#player.knows(door.password)) return 'Unlocked with the word you were given'
    return 'Unlocked'
  }
}
