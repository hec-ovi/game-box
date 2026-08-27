import type { OpenedBundle } from '@gb/bundle'
import type { Asks } from '@gb/world'
import { tidy, type CityBrief } from './brief.ts'

/** One city on the shelf: what it is called, what it was asked to be, and when it was last opened. */
export interface Shelved {
  /** The library's own name for the city: the brief it was made from, or the hash of the file it came in. */
  readonly key: string
  readonly name: string
  readonly theme: string
  readonly seed: string
  readonly blocks: number
  readonly brief?: string
  readonly asks?: Asks
  /** The sealed document's hash, so a city made again from the same brief is known to have moved. */
  readonly hash: string
  /** Made here, or opened from a file somebody sent. */
  readonly source: 'made' | 'opened'
  /** Milliseconds since the epoch. The newest is the city the player was last in. */
  readonly openedAt: number
  /** When the document under this key was written, for the landing screen to say. Absent on a row shelved before it was kept. */
  readonly madeAt?: number
  /** What is in the city, counted once when it is shelved, so the landing screen never opens a document to draw a card. */
  readonly holds?: Holds
}

/** What a city holds, for a card to say what a player is picking up. */
export interface Holds {
  readonly buildings: number
  /** Doors that open. */
  readonly places: number
  readonly people: number
  /** Steps on the main line, which is the length of the story. */
  readonly mainSteps: number
  readonly sideQuests: number
  /** One sentence about the town, from the history it was built on. */
  readonly summary?: string
}

/**
 * Where the shelf is kept: the browser's own database, or memory for a test.
 * Entries and their documents are stored apart, because a list is read every
 * time the panel opens and a document only when a city is.
 */
export interface Shelf {
  list(): Promise<Shelved[]>
  document(key: string): Promise<unknown | undefined>
  put(entry: Shelved, document: unknown): Promise<void>
  remove(key: string): Promise<void>
}

/** A shelf that lasts as long as the page. */
export class MemoryShelf implements Shelf {
  #entries = new Map<string, { entry: Shelved; document: unknown }>()

  async list(): Promise<Shelved[]> {
    return [...this.#entries.values()].map((held) => held.entry)
  }

  async document(key: string): Promise<unknown | undefined> {
    return this.#entries.get(key)?.document
  }

  async put(entry: Shelved, document: unknown): Promise<void> {
    this.#entries.set(entry.key, { entry, document })
  }

  async remove(key: string): Promise<void> {
    this.#entries.delete(key)
  }
}

/**
 * Every city this player has made or opened, and the way back into each. A city
 * made here is filed under the brief it was made from, so asking for the same
 * city again replaces the document and keeps the save, which is what lets a
 * playthrough carry over into a city the model wrote differently. A city that
 * came in as a file is filed under its own hash.
 */
export class Library {
  #shelf: Shelf
  #now: () => number

  constructor(shelf: Shelf, now: () => number = Date.now) {
    this.#shelf = shelf
    this.#now = now
  }

  /**
   * Newest first, so the city the player was last in is the first row. A row
   * shelved before the counts were kept is counted now, off its own document,
   * so the landing screen never has a card that says less than its neighbour.
   */
  async entries(): Promise<Shelved[]> {
    const rows = (await this.#shelf.list()).toSorted((a, b) => b.openedAt - a.openedAt)
    return Promise.all(rows.map((row) => (row.holds ? row : this.#count(row))))
  }

  /** Counts what an older row holds and keeps the answer, so it is read once. */
  async #count(row: Shelved): Promise<Shelved> {
    const document = await this.#shelf.document(row.key)
    const holds = document ? holdsOfDocument(document) : undefined
    if (!holds) return row
    const counted = { ...row, holds }
    await this.#shelf.put(counted, document)
    return counted
  }

  /** The city the player was last in, if they have been in one. */
  async last(): Promise<Shelved | undefined> {
    return (await this.entries())[0]
  }

  async document(key: string): Promise<unknown | undefined> {
    return this.#shelf.document(key)
  }

  /** A city made here from a brief. Its key is the brief, so the same ask lands on the same shelf. */
  async made(brief: CityBrief, city: { bundle: OpenedBundle; document: unknown }): Promise<Shelved> {
    return this.#file(keyOf(brief), brief, 'made', city)
  }

  /** A city that came in as a file. Its key is the file's own hash. */
  async opened(city: { bundle: OpenedBundle; document: unknown }): Promise<Shelved> {
    const world = city.bundle.world
    const brief: CityBrief = { theme: world.theme, seed: world.seed, blocks: 0 }
    return this.#file(city.bundle.contentHash, brief, 'opened', city)
  }

  /**
   * The same city with more of it: a pack went on, so the document under that
   * key is replaced and everything else about the row is kept. The save is
   * keyed the same way, so the playthrough carries into the grown city and
   * `@gb/bundle` reconciles whatever moved.
   */
  async grew(entry: Shelved, city: { bundle: OpenedBundle; document: unknown }): Promise<Shelved> {
    return this.#file(entry.key, briefOf(entry), entry.source, city)
  }

  /** The player went back into a city already on the shelf. */
  async touch(entry: Shelved): Promise<void> {
    const document = await this.#shelf.document(entry.key)
    if (document !== undefined) await this.#shelf.put({ ...entry, openedAt: this.#now() }, document)
  }

  async remove(key: string): Promise<void> {
    await this.#shelf.remove(key)
  }

  async #file(
    key: string,
    brief: CityBrief,
    source: Shelved['source'],
    city: { bundle: OpenedBundle; document: unknown },
  ): Promise<Shelved> {
    const world = city.bundle.world
    const entry: Shelved = {
      key,
      name: world.name,
      theme: brief.theme,
      seed: brief.seed,
      blocks: brief.blocks,
      ...(brief.brief ? { brief: brief.brief } : {}),
      ...(brief.asks ? { asks: brief.asks } : {}),
      hash: city.bundle.contentHash,
      holds: holdsOf(city.bundle),
      source,
      openedAt: this.#now(),
      madeAt: this.#now(),
    }
    await this.#shelf.put(entry, city.document)
    return entry
  }
}

/**
 * What a city holds, counted from the sealed bundle once. A main line is the
 * quests marked main, and its steps are what a player has ahead of them; a
 * summary is the first line of the town's own story, so a card says what the
 * place is rather than only what it is called.
 */
function holdsOf(bundle: OpenedBundle): Holds {
  const world = bundle.world
  const main = bundle.quests.filter((quest) => quest.kind === 'main')
  const premise = world.premise()
  return {
    buildings: world.plots().length,
    places: world.interiors().length,
    people: world.npcs().length,
    mainSteps: main.reduce((total, quest) => total + quest.steps.length, 0),
    sideQuests: bundle.quests.length - main.length,
    ...(premise?.livesOn ? { summary: premise.livesOn } : {}),
  }
}

/**
 * The same counts read straight off a shelved document, for a row written
 * before they were kept. It reads the file's own shape rather than opening the
 * bundle, because a landing screen must not do a city's worth of work per card.
 */
function holdsOfDocument(document: unknown): Holds | undefined {
  const held = document as { world?: { plots?: unknown[]; interiors?: unknown[]; npcs?: unknown[]; premise?: { livesOn?: string } }; quests?: Array<{ kind?: string; steps?: unknown[] }> }
  const world = held?.world
  if (!world?.plots || !world.interiors || !world.npcs) return undefined
  const quests = held.quests ?? []
  const main = quests.filter((quest) => quest.kind === 'main')
  return {
    buildings: world.plots.length,
    places: world.interiors.length,
    people: world.npcs.length,
    mainSteps: main.reduce((total, quest) => total + (quest.steps?.length ?? 0), 0),
    sideQuests: quests.length - main.length,
    ...(world.premise?.livesOn ? { summary: world.premise.livesOn } : {}),
  }
}

/** The brief a shelved city was asked for, for the form to show again. */
export function briefOf(entry: Shelved): CityBrief {
  return tidy({
    theme: entry.theme,
    seed: entry.seed,
    blocks: entry.blocks,
    ...(entry.brief ? { brief: entry.brief } : {}),
    ...(entry.asks ? { asks: entry.asks } : {}),
  })
}

/**
 * A brief's name on the shelf: a digest of everything the generator reads, so
 * the same ask is the same key and one changed word is another city. FNV-1a
 * over the tidied brief, 52 bits in hex: short enough for a store key, wide
 * enough that a library nobody could fill collides on nothing.
 */
export function keyOf(brief: CityBrief): string {
  const text = JSON.stringify(tidy(brief))
  let low = 0x811c9dc5
  let high = 0xcbf29ce4
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    low = Math.imul(low ^ code, 0x01000193) >>> 0
    high = Math.imul(high ^ (code * 31 + i), 0x01000193) >>> 0
  }
  return `made-${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}
