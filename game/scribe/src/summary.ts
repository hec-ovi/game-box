import type { WorldSummary } from '@gb/forge'
import { Rng } from '@gb/kit'

type Place = WorldSummary['places'][number]

/** The five questions `@gb/quest` asks of a world, answered from the summary alone. */
export interface SummaryView {
  hasNpc(id: string): boolean
  hasPlot(id: string): boolean
  hasInterior(id: string): boolean
  hasItem(id: string): boolean
  hasAnchor(interiorId: string, anchorId: string): boolean
}

/**
 * The abstract city a quest writer reads.
 *
 * It answers the world questions `@gb/quest` asks, so a draft is checked here
 * against the same ids the model was shown rather than handed on and dropped
 * later. It answers no to interiors and anchors, because a summary does not name
 * them: that is stricter than the real world, so a quest this accepts is a quest
 * the forge accepts.
 */
export class CitySummary {
  #summary: WorldSummary
  #npcIds: Set<string>
  #plotIds: Set<string>
  #itemIds: Set<string>

  constructor(summary: WorldSummary) {
    this.#summary = summary
    this.#plotIds = new Set(summary.places.map((place) => place.plotId))
    this.#npcIds = new Set(summary.places.flatMap((place) => place.npcs.map((npc) => npc.npcId)))
    this.#itemIds = new Set(summary.places.flatMap((place) => place.items.map((item) => item.itemId)))
  }

  get cityName(): string {
    return this.#summary.cityName
  }

  get theme(): string {
    return this.#summary.theme
  }

  view(): SummaryView {
    return {
      hasNpc: (id) => this.#npcIds.has(id),
      hasPlot: (id) => this.#plotIds.has(id),
      hasInterior: () => false,
      hasItem: (id) => this.#itemIds.has(id),
      hasAnchor: () => false,
    }
  }

  /** Places worth writing about: somebody is in them, or something is. */
  peopled(): readonly Place[] {
    return this.#summary.places.filter((place) => place.npcs.length > 0 || place.items.length > 0)
  }

  /**
   * The corner of the city one quest is set in.
   *
   * A quest reads better and costs less when it is handed a street rather than a
   * borough: at 7x7 the whole city is 224 places, and sending all of them on
   * every call buys nothing but tokens. The slice is drawn from the build's own
   * seed and the quest's index, so it is the same on every run, and it always
   * carries somebody to hand the errand out and something to pick up, as long as
   * the city has any.
   */
  neighbourhood(seed: string, index: number, size: number): readonly Place[] {
    const pool = this.peopled()
    if (pool.length <= size) return pool

    const order = new Rng(`${seed}:quest_${index}`).shuffle(pool.slice()) as Place[]
    const chosen = new Set<Place>()
    const take = (wanted: (place: Place) => boolean, upTo: number): void => {
      let taken = 0
      for (const place of order) {
        if (chosen.size >= size || taken >= upTo) return
        if (chosen.has(place) || !wanted(place)) continue
        chosen.add(place)
        taken++
      }
    }
    take((place) => place.npcs.length > 0, 2)
    take((place) => place.items.length > 0, 2)
    take(() => true, size)
    return pool.filter((place) => chosen.has(place))
  }
}

/** The places written out for the model, by id, in the order the summary holds them. */
export function describePlaces(places: readonly Place[]): string {
  return places
    .map((place) => {
      const people =
        place.npcs.map((npc) => `${npc.name} (${npc.role}, ${npc.npcId})`).join('; ') || 'nobody'
      const things =
        place.items
          .map((item) => `${item.name} (${item.itemId}${item.ownerNpcId ? `, owned by ${item.ownerNpcId}` : ''})`)
          .join('; ') || 'nothing'
      return `- ${place.name}, a ${place.kind} (${place.plotId})\n    people: ${people}\n    things: ${things}`
    })
    .join('\n')
}
