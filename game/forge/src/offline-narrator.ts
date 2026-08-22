import { Rng } from '@gb/kit'
import type { BuildingKind, ItemArchetype, NpcRole } from '@gb/world'
import type { ItemProfile, Narrator, NpcProfile, WorldSummary } from './narrator.ts'

const FIRST = ['Mara', 'Hollis', 'Juno', 'Sable', 'Cass', 'Ivo', 'Delia', 'Rook', 'Neve', 'Tam', 'Orla', 'Bez', 'Wren', 'Odis']
const LAST = ['Cole', 'Vance', 'Marek', 'Dunn', 'Ashby', 'Quill', 'Ferro', 'Stroud', 'Lange', 'Reyes', 'Kade', 'Orso']

const PLACE_ADJECTIVES = ['Rusty', 'Quiet', 'Broken', 'Golden', 'Last', 'Old', 'Iron', 'Salt', 'Copper', 'Grey']
const PLACE_NOUNS = ['Nail', 'Lantern', 'Anchor', 'Spur', 'Kettle', 'Wheel', 'Crow', 'Mill', 'Coin', 'Post']

const PLACE_PATTERNS: Partial<Record<BuildingKind, (a: string, n: string, family: string) => string>> = {
  bar: (a, n) => `The ${a} ${n}`,
  cafe: (a, n) => `${a} ${n} Coffee`,
  restaurant: (a, n) => `${n} House`,
  shop: (_a, _n, family) => `${family} Supply`,
  market: (a) => `${a} Market`,
  office: (_a, _n, family) => `${family} & Co.`,
  workshop: (_a, _n, family) => `${family} Repairs`,
  warehouse: (a) => `${a} Depot`,
  clinic: (_a, _n, family) => `${family} Surgery`,
  hotel: (a, n) => `The ${a} ${n} Rooms`,
  station: (a) => `${a} Station`,
  chapel: (a) => `${a} Chapel`,
  house: (_a, _n, family) => `${family} House`,
  apartment: (a) => `${a} Apartments`,
}

const ROLE_TRAITS: Record<NpcRole, string> = {
  bartender: 'pours slowly, listens hard, forgets nothing',
  patron: 'here most nights, opinions on everything',
  clerk: 'polite, precise, watching the clock',
  resident: 'keeps to themselves, notices the street',
  worker: 'tired, straightforward, wants the shift over',
  vendor: 'cheerful until you haggle',
  cook: 'brusque, proud of the food, hates waste',
  receptionist: 'friendly on the surface, sharp underneath',
  mechanic: 'talks in parts and prices',
  courier: 'always half out the door',
  guard: 'bored, but not as bored as they look',
  wanderer: 'drifted in from somewhere, vague about where',
}

/**
 * A narrator that invents everything from the seed, with no model behind it.
 * It keeps the generator runnable and testable offline, and it is the shape a
 * language-model narrator has to match.
 */
export class OfflineNarrator implements Narrator {
  #rng: Rng
  #usedNames = new Set<string>()

  constructor(seed: string) {
    this.#rng = new Rng(`narrator/${seed}`)
  }

  /** Nobody in a town shares a name with anybody else in it. */
  #uniqueName(rng: Rng): string {
    for (let attempt = 0; attempt < 40; attempt++) {
      const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`
      if (!this.#usedNames.has(name)) {
        this.#usedNames.add(name)
        return name
      }
    }
    const fallback = `${rng.pick(FIRST)} ${rng.pick(LAST)} the ${rng.pick(['Younger', 'Elder', 'Quiet', 'Tall', 'Lame'])}`
    this.#usedNames.add(fallback)
    return fallback
  }

  async nameCity(input: { theme: string; seed: string }): Promise<string> {
    const rng = this.#rng.fork(`city/${input.seed}`)
    return `${rng.pick(PLACE_ADJECTIVES)} ${rng.pick(['Hollow', 'Crossing', 'Reach', 'Flats', 'Junction', 'Bend'])}`
  }

  async namePlace(input: { kind: BuildingKind; theme: string; index: number }): Promise<string> {
    const rng = this.#rng.fork(`place/${input.kind}/${input.index}`)
    const pattern = PLACE_PATTERNS[input.kind] ?? ((a: string, n: string) => `${a} ${n}`)
    return pattern(rng.pick(PLACE_ADJECTIVES), rng.pick(PLACE_NOUNS), rng.pick(LAST))
  }

  async describeNpc(input: {
    role: NpcRole
    placeKind: BuildingKind
    placeName: string
    theme: string
    index: number
  }): Promise<NpcProfile> {
    const rng = this.#rng.fork(`npc/${input.index}`)
    const name = this.#uniqueName(rng)
    return {
      name,
      personality: `${ROLE_TRAITS[input.role]}. Works at ${input.placeName}.`,
      knowledge: [
        `Works at ${input.placeName} as the ${input.role}.`,
        `Knows the regulars at ${input.placeName} by name.`,
      ],
    }
  }

  async describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<ItemProfile> {
    const rng = this.#rng.fork(`item/${input.index}`)
    const adjective = rng.pick(['worn', 'dented', 'unmarked', 'heavy', 'cheap', 'sealed'])
    return {
      name: `${adjective[0]!.toUpperCase()}${adjective.slice(1)} ${input.archetype}`,
      description: `A ${adjective} ${input.archetype}. Nothing about it invites questions.`,
    }
  }

  /**
   * Fetch-and-deliver quests over whoever is actually in the world: take a
   * thing from one place, walk it to a person in another, get paid.
   */
  async writeQuests(input: { summary: WorldSummary; sideQuests: number }): Promise<unknown[]> {
    const withNpcs = input.summary.places.filter((p) => p.npcs.length > 0)
    const withItems = input.summary.places.filter((p) => p.items.length > 0 && p.npcs.length > 0)
    if (withNpcs.length < 2 || withItems.length < 1) return []

    const quests: unknown[] = []
    const total = Math.min(input.sideQuests + 1, withItems.length * withNpcs.length)
    for (let i = 0; i < total; i++) {
      const rng = this.#rng.fork(`quest/${i}`)
      const source = withItems[i % withItems.length]!
      const target = withNpcs.filter((p) => p.plotId !== source.plotId)[i % Math.max(1, withNpcs.length - 1)]
      if (!target) continue

      const item = source.items[i % source.items.length]!
      const giver = target.npcs[0]!
      const holder = source.npcs[0]!
      const stolen = item.ownerNpcId !== undefined
      const pay = rng.int(15, 60)

      quests.push({
        format: 'game-box.quest',
        schemaVersion: 1,
        id: `quest_${String(i + 1).padStart(4, '0')}`,
        kind: i === 0 ? 'main' : 'side',
        title: `${item.name} for ${giver.name}`,
        summary: `${giver.name} at ${target.name} wants the ${item.name.toLowerCase()} that ${holder.name} keeps at ${source.name}.`,
        giverNpcId: giver.npcId,
        startStepId: 'step_0001',
        steps: [
          {
            id: 'step_0001',
            kind: 'talk',
            npcId: giver.npcId,
            objective: `Hear ${giver.name} out at ${target.name}`,
            next: ['step_0002'],
            requires: [],
            effects: [],
          },
          {
            id: 'step_0002',
            kind: 'goto',
            place: { plotId: source.plotId },
            objective: `Go to ${source.name}`,
            next: ['step_0003'],
            requires: [],
            effects: [],
          },
          {
            id: 'step_0003',
            kind: 'collect',
            itemId: item.itemId,
            allowSteal: stolen,
            objective: stolen ? `Take the ${item.name.toLowerCase()} without a fuss` : `Pick up the ${item.name.toLowerCase()}`,
            next: ['step_0004'],
            requires: [],
            effects: [],
          },
          {
            id: 'step_0004',
            kind: 'deliver',
            itemId: item.itemId,
            toNpcId: giver.npcId,
            objective: `Bring it back to ${giver.name}`,
            next: ['step_0005'],
            requires: [],
            effects: [{ kind: 'set-flag', flag: `delivered_${item.itemId}`, value: true }],
          },
          { id: 'step_0005', kind: 'complete', objective: 'Get paid', next: [], requires: [], effects: [] },
        ],
        reward: { money: pay, reputation: stolen ? -2 : 3, faction: 'town', items: [] },
      })
    }
    return quests
  }
}
