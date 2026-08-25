import type { WorldSummary } from '@gb/forge'
import { premiseLines } from '@gb/forge'
import type { Asks } from '@gb/world'
import { prompt } from './prompts.ts'

type Place = WorldSummary['places'][number]

/** The summary as the quest writer takes it: the forge's, plus what the owner asked of the quests. */
export type QuestSummary = WorldSummary & { readonly asks?: Asks | undefined }

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
  #summary: QuestSummary
  #npcIds: Set<string>
  #plotIds: Set<string>
  #itemIds: Set<string>

  constructor(summary: QuestSummary) {
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

  get asks(): Asks | undefined {
    return this.#summary.asks
  }

  /** The town's story as a prompt reads it. */
  get history(): string {
    return this.#summary.premise ? premiseLines(this.#summary.premise) : prompt('no-history')
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
}
