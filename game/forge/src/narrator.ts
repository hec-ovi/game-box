import type { BuildingKind, ItemArchetype, NpcRole } from '@gb/world'

export interface NpcProfile {
  readonly name: string
  readonly personality: string
  readonly knowledge: readonly string[]
}

export interface ItemProfile {
  readonly name: string
  readonly description: string
}

/** The abstract world a quest writer sees: who is where, and what is lying about. */
export interface WorldSummary {
  readonly cityName: string
  readonly theme: string
  readonly places: ReadonlyArray<{
    readonly plotId: string
    readonly interiorId?: string
    readonly kind: BuildingKind
    readonly name: string
    /** Where its street door is, in metres: how far a job makes the player walk. */
    readonly door?: { readonly x: number; readonly z: number }
    /** A surface inside it something can be left on, when it has one. */
    readonly stashAnchorId?: string
    readonly npcs: ReadonlyArray<{ readonly npcId: string; readonly name: string; readonly role: NpcRole }>
    readonly items: ReadonlyArray<{
      readonly itemId: string
      readonly name: string
      readonly archetype?: ItemArchetype
      readonly ownerNpcId?: string
    }>
  }>
}

/**
 * Everything about a world that is invention rather than geometry: names,
 * personalities, what people know, and the quests that string them together.
 * The generator never asks a narrator for coordinates.
 */
export interface Narrator {
  nameCity(input: { theme: string; seed: string }): Promise<string>
  namePlace(input: { kind: BuildingKind; theme: string; index: number }): Promise<string>
  describeNpc(input: {
    role: NpcRole
    placeKind: BuildingKind
    placeName: string
    theme: string
    index: number
  }): Promise<NpcProfile>
  describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<ItemProfile>
  /** Raw quest documents. The generator validates them and drops the ones that do not hold up. */
  writeQuests(input: { summary: WorldSummary; sideQuests: number }): Promise<unknown[]>
}
