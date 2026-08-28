import type { WorldSummary } from '@gb/forge'
import { premiseLines } from '@gb/forge'
import type { WorldView } from '@gb/quest'
import type { Asks } from '@gb/world'
import { CityLocks } from './locks.ts'
import { prompt } from './prompts.ts'

type Place = WorldSummary['places'][number]

/** The summary as the quest writer takes it: the forge's, plus what the owner asked of the quests. */
export type QuestSummary = WorldSummary & { readonly asks?: Asks | undefined }

/**
 * The abstract city a quest writer reads.
 *
 * It answers the world questions `@gb/quest` asks, so a draft is checked here
 * against the same ids the model was shown rather than handed on and dropped
 * later. It answers no to anchors, because a summary does not name them: that
 * is stricter than the real world, so a quest this accepts is a quest the forge
 * accepts. An interior is known by the place that opens on it, which is what an
 * access or a deed reward names. A key named by a lock is a thing the city
 * holds even though it lies in a pocket rather than on a shelf, so it answers
 * yes to those. A plot opens where the place standing on it has an interior:
 * the rest of a city is frontage, and an errand that ends at a wall is one the
 * player cannot finish.
 */
export class CitySummary {
  #summary: QuestSummary
  #npcIds: Set<string>
  #plotIds: Set<string>
  #openPlotIds: Set<string>
  #itemIds: Set<string>
  #interiorIds: Set<string>
  #locks: CityLocks

  constructor(summary: QuestSummary) {
    this.#summary = summary
    this.#plotIds = new Set(summary.places.map((place) => place.plotId))
    this.#openPlotIds = new Set(summary.places.flatMap((place) => (place.interiorId ? [place.plotId] : [])))
    this.#npcIds = new Set(summary.places.flatMap((place) => place.npcs.map((npc) => npc.npcId)))
    this.#interiorIds = new Set(summary.places.flatMap((place) => (place.interiorId ? [place.interiorId] : [])))
    this.#locks = new CityLocks(summary.places)
    this.#itemIds = new Set([
      ...summary.places.flatMap((place) => place.items.map((item) => item.itemId)),
      ...this.#locks.keyItems(),
    ])
  }

  get cityName(): string {
    return this.#summary.cityName
  }

  get theme(): string {
    return this.#summary.theme
  }

  get asks(): Asks | undefined {
    return this.#summary.asks
  }

  /** What each part of the city is called, by its id: the coarsest handle a quest writer is given on where a place is. */
  get districts(): ReadonlyMap<string, string> {
    return new Map((this.#summary.districts ?? []).map((district) => [district.districtId, district.name]))
  }

  /** The town's story as a prompt reads it. */
  get history(): string {
    return this.#summary.premise ? premiseLines(this.#summary.premise) : prompt('no-history')
  }

  /** The city's locks, screens and counters, by id. */
  get locks(): CityLocks {
    return this.#locks
  }

  view(): WorldView {
    return {
      hasNpc: (id) => this.#npcIds.has(id),
      hasPlot: (id) => this.#plotIds.has(id),
      hasInterior: (id) => this.#interiorIds.has(id),
      hasItem: (id) => this.#itemIds.has(id),
      hasAnchor: () => false,
      hasDoor: (id) => this.#locks.door(id) !== undefined,
      hasMachine: (id) => this.#locks.screen(id) !== undefined,
      opens: (id) => this.#openPlotIds.has(id),
    }
  }

  /** Places worth writing about: somebody is in them, or something is. */
  peopled(): readonly Place[] {
    return this.#summary.places.filter((place) => place.npcs.length > 0 || place.items.length > 0)
  }
}
