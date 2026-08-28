import type { WorldSummary } from '@gb/forge'
import type { Violation } from './asker.ts'
import type { QuestSheet } from './tools.ts'

type Place = WorldSummary['places'][number]
type Beat = QuestSheet['beats'][number]
type Plain = Exclude<Beat, { kind: 'choice' }>

/**
 * Holds the words of a beat to what its ids point at.
 *
 * A beat names its people, places and things by id, and beside them sits the
 * line the player reads, which is free text nothing checks. Measured on a live
 * city: a beat pointed at `plot_0026` and its line read "Head out to the old
 * customs house", a building that town does not have. The marker went where the
 * id said and the sentence sent the player somewhere else. Nothing downstream
 * can catch it either: binding swaps the names the town was laid out under, so
 * an invented one travels untouched all the way to the player.
 *
 * The names here are the summary's own, whatever they are at the time: the
 * placeholders a town is laid out under while it is being built (`Instance 12`),
 * the written names when a growth writes work over a city that already has
 * them. Two things are refused, and only those, because they are the two that
 * can be proved wrong off the summary alone:
 *
 * - **A beat that sends the player somewhere says where.** A `goto` or an
 *   `escort` is nothing but the walk, so its line has to call the building by
 *   the one name the town has for it.
 * - **A beat names only where it happens.** A person or a place named in a line
 *   that the beat does not point at is a person standing in another building or
 *   a door on another street, which is the flat bag of people this replaces: if
 *   a place holds four people, those are the four that line may name.
 *
 * A line that names nobody and nowhere ("Ask her what she knows") is left alone.
 * It promises nothing, so there is nothing in it to be wrong.
 */
export function wordingProblems(beats: readonly Beat[], corner: CornerWords): Violation[] {
  return problemsIn(beats, 'beats', corner)
}

function problemsIn(beats: readonly Beat[], path: string, corner: CornerWords): Violation[] {
  const problems: Violation[] = []
  beats.forEach((beat, index) => {
    const at = `${path}.${index}`
    if (beat.kind !== 'choice') {
      const where = placesOf([beat], corner)
      problems.push(...saidIn(beat.objective, `${at}.objective`, where, corner))
      if (beat.kind === 'talk' && beat.topic) problems.push(...saidIn(beat.topic, `${at}.topic`, where, corner))
      problems.push(...walksTo(beat, at, corner))
      return
    }
    // a fork is about what its roads do, so it may say anything they may say
    const whole = placesOf(beat.options.flatMap((road) => road.beats), corner)
    problems.push(...saidIn(beat.objective, `${at}.objective`, whole, corner))
    problems.push(...saidIn(beat.prompt, `${at}.prompt`, whole, corner))
    beat.options.forEach((road, roadIndex) => {
      const where = placesOf(road.beats, corner)
      problems.push(...saidIn(road.label, `${at}.options.${roadIndex}.label`, where, corner))
      problems.push(...problemsIn(road.beats, `${at}.options.${roadIndex}.beats`, corner))
    })
  })
  return problems
}

/** The walk has to say where it ends, because the line is the whole of what the player is told. */
function walksTo(beat: Plain, at: string, corner: CornerWords): Violation[] {
  const to = destinationOf(beat)
  const where = to === undefined ? undefined : corner.at(to)
  if (to === undefined || where === undefined) return []
  const name = corner.placeName(where)
  if (says(beat.objective, name) || says(beat.objective, bare(name))) return []
  return [
    {
      path: `${at}.objective`,
      message: `this beat sends the player to ${to}, which this town calls ${name}: say ${name} in the line, and never a name of your own`,
    },
  ]
}

/** Every name in this line that belongs somewhere the beat does not go. */
function saidIn(text: string, path: string, where: ReadonlySet<number>, corner: CornerWords): Violation[] {
  if (where.size === 0) return []
  const here = [...where].map((at) => corner.placeName(at)).join(' and ')
  return corner.strays(text, corner.allowed(where)).map((stray) => ({
    path,
    message:
      stray.what === 'person'
        ? `${stray.name} is not at ${here}, where this beat happens: name only the people standing there (${corner.peopleAt(where)})`
        : `${stray.name} is not where this beat happens: it is set at ${here}, so name that and what is in it`,
  }))
}

/** The places of the corner a run of beats happens in: wherever what they name by id stands. */
function placesOf(beats: readonly Beat[], corner: CornerWords): ReadonlySet<number> {
  const where = new Set<number>()
  for (const beat of beats) {
    if (beat.kind === 'choice') continue
    for (const id of idsIn(beat)) {
      const at = corner.at(id)
      if (at !== undefined) where.add(at)
    }
  }
  return where
}

/** Everything a beat points at, by id. */
function idsIn(beat: Plain): readonly string[] {
  const named: (string | undefined)[] = [destinationOf(beat)]
  if ('npcId' in beat) named.push(beat.npcId)
  if ('toNpcId' in beat) named.push(beat.toNpcId)
  if ('itemId' in beat) named.push(beat.itemId, ...('alternates' in beat ? (beat.alternates ?? []) : []))
  if ('machineId' in beat) named.push(beat.machineId)
  if ('doorId' in beat) named.push(beat.doorId)
  if ('interiorId' in beat) named.push(beat.interiorId)
  return named.filter((id): id is string => id !== undefined)
}

/** Where a beat walks the player, when walking them there is the whole of the beat. */
function destinationOf(beat: Plain): string | undefined {
  if (beat.kind !== 'goto' && beat.kind !== 'escort') return undefined
  return 'plotId' in beat.where ? beat.where.plotId : beat.where.interiorId
}

/** A name in a line, and what it belongs to. */
interface Named {
  readonly name: string
  readonly what: 'person' | 'building' | 'part of town'
  /** Which place of the corner it belongs to. */
  readonly at: number
}

/**
 * What the corner a quest is written about is called: every place, every part of
 * town and everybody in them, against the place each of them belongs to.
 *
 * People and places are read for strays and things are not, because a thing's
 * name is often an ordinary word (a crate, a ledger) and a line using the word
 * proves nothing, while a line naming a person or a building names one thing
 * and one only. Things are still held: a beat may name what lies where it
 * happens.
 */
export class CornerWords {
  #places: readonly Place[]
  #at = new Map<string, number>()
  #names: Named[] = []
  #held: string[][] = []

  constructor(places: readonly Place[], districts: ReadonlyMap<string, string>) {
    this.#places = places
    places.forEach((place, at) => {
      const held: string[] = [place.name.toLowerCase()]
      this.#names.push({ name: place.name, what: 'building', at })
      this.#hold(place.plotId, at)
      if (place.interiorId) this.#hold(place.interiorId, at)

      const district = place.districtId ? districts.get(place.districtId) : undefined
      if (district) {
        this.#names.push({ name: district, what: 'part of town', at })
        held.push(district.toLowerCase())
      }
      for (const npc of place.npcs) {
        this.#names.push({ name: npc.name, what: 'person', at })
        held.push(npc.name.toLowerCase())
        this.#hold(npc.npcId, at)
      }
      for (const item of place.items) {
        held.push(item.name.toLowerCase())
        this.#hold(item.itemId, at)
      }
      for (const lock of place.locks ?? []) {
        this.#hold(lock.doorId, at)
        // the key is in somebody's pocket here, so it is not in the stock and is
        // still a thing a beat of this place may name
        if (lock.keyItemId) this.#hold(lock.keyItemId, at)
      }
      for (const machine of place.machines ?? []) this.#hold(machine.machineId, at)
      this.#held.push(held)
    })
  }

  /** Which place of the corner this id stands in. */
  at(id: string): number | undefined {
    return this.#at.get(id)
  }

  /** What the town calls that place. */
  placeName(at: number): string {
    return this.#places[at]!.name
  }

  /** Everybody standing in these places, for the sentence a refusal comes back as. */
  peopleAt(where: ReadonlySet<number>): string {
    const people = [...where].flatMap((at) => this.#places[at]!.npcs.map((npc) => npc.name))
    return people.join(', ') || 'nobody'
  }

  /** Everything the places of this corner are called, and everybody and everything in them. */
  allowed(where: ReadonlySet<number>): ReadonlySet<string> {
    return new Set([...where].flatMap((at) => this.#held[at] ?? []))
  }

  /** The people and places this line names that are not among those. */
  strays(text: string, allowed: ReadonlySet<string>): readonly Named[] {
    const found = new Map<string, Named>()
    for (const named of this.#names) {
      if (found.has(named.name) || allowed.has(named.name.toLowerCase())) continue
      if (says(text, named.name)) found.set(named.name, named)
    }
    return [...found.values()]
  }

  #hold(id: string, at: number): void {
    this.#at.set(id, at)
  }
}

/** Whether a line calls something by that name: whole words, whatever case the sentence put it in. */
function says(text: string, name: string): boolean {
  if (name.length === 0) return false
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped(name)}(?![\\p{L}\\p{N}])`, 'iu').test(text)
}

/** A sign is read without its "The", so a line saying "back to the Anchor" says the name over that door. */
function bare(name: string): string {
  return name.replace(/^the\s+/i, '')
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
