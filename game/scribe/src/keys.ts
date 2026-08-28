import { leaving, namedBy, type Given } from './carry.ts'
import type { CityLocks, Door } from './locks.ts'
import type { QuestSheet } from './tools.ts'

type Beat = QuestSheet['beats'][number]
type Plain = Exclude<Beat, { kind: 'choice' }>

/** A run of beats with the way past every lock in it opened, and where each of them was written. */
export interface Opened {
  readonly beats: Beat[]
  /** The path of each beat in the run, against the path it had in the model's own list. */
  readonly toldAt: ReadonlyMap<string, string>
}

/**
 * Opens the way past the locks a run of beats walks into.
 *
 * Getting a key out of a pocket before a door, or a code out of somebody before
 * a screen, is bookkeeping: it is knowing that a thing has to be true by the
 * time a later beat runs, which is the one job a small model cannot hold on to.
 * The city knows who carries which key and what every code is, so the beats it
 * takes are the beats the writer told plus the conversations they imply: a talk
 * with the keeper who hands the key over, a talk with somebody on the floor who
 * gives up the code, and the `unlock` in front of anything standing behind a
 * shut door.
 *
 * Nobody is invented. The keeper and the person on the floor are the city's own
 * people, and a lock with nobody to ask about it is left shut, so `reach.ts`
 * reports it and the writer hears about it.
 */
export function openTheWay(beats: readonly Beat[], city: CityLocks): Opened {
  const locksmith = new Locksmith(city)
  return { beats: locksmith.run(beats, new Set(), 'beats', 'beats'), toldAt: locksmith.toldAt }
}

class Locksmith {
  readonly toldAt = new Map<string, string>()
  #city: CityLocks

  constructor(city: CityLocks) {
    this.#city = city
  }

  /** One run of beats, with the way opened in front of each. `told` is where this run sits in the writer's own list. */
  run(beats: readonly Beat[], facts: Set<string>, path: string, told: string): Beat[] {
    const out: Beat[] = []
    const put = (beat: Beat, from: string): void => {
      this.toldAt.set(`${path}.${out.length}`, from)
      out.push(beat)
    }

    let carried = facts
    beats.forEach((beat, index) => {
      const from = `${told}.${index}`
      if (beat.kind === 'choice') {
        const at = out.length
        const roads = beat.options.map((road, road_index) => ({
          ...road,
          beats: this.run(road.beats, new Set(carried), `${path}.${at}.options.${road_index}.beats`, `${from}.options.${road_index}.beats`) as Plain[],
        }))
        const ends = roads.map((road) => this.#after(road.beats, new Set(carried)))
        put({ ...beat, options: roads }, from)
        // one road is walked, so only what every road leaves behind still holds
        carried = new Set([...ends[0]!].filter((fact) => ends.every((end) => end.has(fact))))
        return
      }
      this.#wayTo(beat, carried, from, put)
      put(beat, from)
      carried = leaving(beat, handedBy(beat), carried)
    })
    return out
  }

  /** Everything a run of beats leaves the player holding, for working out what a fork's roads agree on. */
  #after(beats: readonly Plain[], facts: Set<string>): Set<string> {
    let carried = facts
    for (const beat of beats) carried = leaving(beat, handedBy(beat), carried)
    return carried
  }

  /** Whatever has to happen before this beat can be done: the doors in front of what it names, and the way past its own lock. */
  #wayTo(beat: Plain, facts: Set<string>, told: string, put: (beat: Beat, from: string) => void): void {
    for (const { ids } of namedBy(beat)) {
      for (const id of ids) {
        for (const doorId of this.#city.between(id)) this.#openDoor(doorId, facts, told, put)
      }
    }
    if (beat.kind === 'unlock') this.#waysPast(this.#city.door(beat.doorId), facts, told, put)
    if (beat.kind === 'hack') this.#learnCode(beat.machineId, facts, told, put)
  }

  /** Gets past a door and through it, where the city holds a way. A door nobody can open is left shut. */
  #openDoor(doorId: string, facts: Set<string>, told: string, put: (beat: Beat, from: string) => void): void {
    if (facts.has(`door:${doorId}`)) return
    const door = this.#city.door(doorId)
    if (!door) return
    for (const before of this.#city.between(doorId)) this.#openDoor(before, facts, told, put)
    if (!this.#waysPast(door, facts, told, put)) return

    put({ kind: 'unlock', doorId, objective: `Open the ${door.room} door at ${door.placeName}.` }, told)
    facts.add(`door:${doorId}`)
  }

  /** Puts the key in the player's hand or the code in their head, and says whether the door can now be opened. */
  #waysPast(door: Door | undefined, facts: Set<string>, told: string, put: (beat: Beat, from: string) => void): boolean {
    if (!door) return false
    if (door.keyItemId && facts.has(`item:${door.keyItemId}`)) return true
    if (door.password && facts.has(`word:${door.password}`)) return true

    const keeper = door.keeperNpcId
    if (door.keyItemId && keeper && this.#city.between(keeper).length === 0) {
      const key = (this.#city.nameOf(door.keyItemId) ?? 'key').replace(/^the /i, '')
      put(this.#asking(keeper, [{ kind: 'give-item', itemId: door.keyItemId }], `Get the ${key} off`), told)
      facts.add(`item:${door.keyItemId}`)
      return true
    }
    if (door.password) {
      const asker = this.#city.askAbout(door.doorId)
      if (!asker) return false
      put(this.#asking(asker, [{ kind: 'give-password', password: door.password }], 'Get the door code out of'), told)
      facts.add(`word:${door.password}`)
      return true
    }
    return false
  }

  /** Gets the code for a locked screen out of somebody standing where it is. */
  #learnCode(machineId: string, facts: Set<string>, told: string, put: (beat: Beat, from: string) => void): void {
    const screen = this.#city.screen(machineId)
    if (!screen?.locked || !screen.password || facts.has(`word:${screen.password}`)) return
    const asker = this.#city.askAbout(machineId)
    if (!asker) return

    put(this.#asking(asker, [{ kind: 'give-password', password: screen.password }], 'Get the screen code out of'), told)
    facts.add(`word:${screen.password}`)
  }

  /** The conversation that hands something over, written to whoever is standing there. */
  #asking(npcId: string, hands: Given[], asking: string): Beat {
    const who = this.#city.nameOf(npcId) ?? 'them'
    const where = this.#city.placeOf(npcId)
    return { kind: 'talk', npcId, hands, objective: `${asking} ${who}${where ? ` at ${where}` : ''}.` } as Beat
  }
}

/** A complaint about the run the compiler was given, said about the beat the writer actually wrote. */
export function toldPath(path: string, toldAt: ReadonlyMap<string, string>): string {
  const found = /^(beats\.\d+(?:\.options\.\d+\.beats\.\d+)?)(.*)$/.exec(path)
  const head = found ? toldAt.get(found[1]!) : undefined
  return head === undefined ? path : `${head}${found![2] ?? ''}`
}

/** What a beat hands the player, in the shape the carry walk reads. */
function handedBy(beat: Plain): readonly Given[] {
  return beat.kind === 'talk' ? (beat.hands ?? []) : []
}
