import type { ItemProfile, Narrator, NpcProfile, WorldSummary } from '@gb/forge'
import { OfflineNarrator } from '@gb/forge'
import { contract, type Contract } from '@gb/kit'
import { sealQuest, questDraftContract } from '@gb/quest'
import type { BuildingKind, ItemArchetype, NpcRole } from '@gb/world'
import { z } from 'zod'
import { PROMPTS } from './prompts.generated.ts'
import { Sidecar, type SidecarError } from './sidecar.ts'

const CityName = contract('name_city', z.object({ name: z.string().min(2).max(60) }))
const PlaceName = contract('name_place', z.object({ name: z.string().min(2).max(80) }))
const NpcProfileContract = contract(
  'describe_npc',
  z.object({
    name: z.string().min(2).max(60),
    personality: z.string().min(10).max(400),
    knowledge: z.array(z.string().min(4).max(300)).min(2).max(4),
  }),
)
const ItemProfileContract = contract(
  'describe_item',
  z.object({ name: z.string().min(2).max(60), description: z.string().min(4).max(300) }),
)

/** One authoring call that did not work out, kept so a thin world is explainable. */
export interface ScribeProblem {
  readonly task: string
  readonly error: SidecarError
}

export interface ScribeOptions {
  readonly sidecar?: Sidecar
  /** Used whenever the model cannot answer, so a world always generates. */
  readonly fallback?: Narrator
  readonly seed?: string
  /** Tries per call before falling back. */
  readonly attempts?: number
}

/**
 * The narrator backed by the local model. Every answer is a forced tool call
 * validated against the schema the tool was built from, so nothing reaches the
 * world as prose. When a call cannot be made good, the offline narrator answers
 * instead and the failure is recorded rather than hidden.
 */
export class Scribe implements Narrator {
  #sidecar: Sidecar
  #fallback: Narrator
  #attempts: number
  #problems: ScribeProblem[] = []

  constructor(options: ScribeOptions = {}) {
    this.#sidecar = options.sidecar ?? new Sidecar()
    this.#fallback = options.fallback ?? new OfflineNarrator(options.seed ?? 'scribe')
    this.#attempts = Math.max(1, options.attempts ?? 2)
  }

  problems(): readonly ScribeProblem[] {
    return this.#problems
  }

  async nameCity(input: { theme: string; seed: string }): Promise<string> {
    const answer = await this.#ask('name_city', CityName, fill(PROMPTS['name-city'], input))
    return answer?.name ?? this.#fallback.nameCity(input)
  }

  async namePlace(input: { kind: BuildingKind; theme: string; index: number }): Promise<string> {
    const answer = await this.#ask('name_place', PlaceName, fill(PROMPTS['name-place'], input))
    return answer?.name ?? this.#fallback.namePlace(input)
  }

  async describeNpc(input: {
    role: NpcRole
    placeKind: BuildingKind
    placeName: string
    theme: string
    index: number
  }): Promise<NpcProfile> {
    const answer = await this.#ask('describe_npc', NpcProfileContract, fill(PROMPTS['describe-npc'], input))
    return answer ?? this.#fallback.describeNpc(input)
  }

  async describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<ItemProfile> {
    const answer = await this.#ask('describe_item', ItemProfileContract, fill(PROMPTS['describe-item'], input))
    return answer ?? this.#fallback.describeItem(input)
  }

  /**
   * One call per quest. A small model writes a better single quest than a batch,
   * and a call that fails costs one quest rather than all of them.
   */
  async writeQuests(input: { summary: WorldSummary; sideQuests: number }): Promise<unknown[]> {
    const count = Math.max(1, Math.min(input.sideQuests + 1, 12))
    const places = describePlaces(input.summary)
    if (!places) return this.#fallback.writeQuests(input)

    const quests: unknown[] = []
    for (let i = 0; i < count; i++) {
      const prompt = fill(PROMPTS['write-quests'], {
        theme: input.summary.theme,
        cityName: input.summary.cityName,
        places,
        questCount: '1',
      })
      const numbered = `${prompt}\n\nThis is quest ${i + 1} of ${count}. Give it the id quest_${String(i + 1).padStart(4, '0')}${
        i === 0 ? ' and make it the main one.' : ' and make it a side one.'
      }`
      const draft = await this.#ask(`write_quest`, questDraftContract, numbered)
      if (draft) quests.push(sealQuest(draft))
    }
    return quests.length ? quests : this.#fallback.writeQuests(input)
  }

  async #ask<T>(toolName: string, shape: Contract<T>, user: string): Promise<T | undefined> {
    let request = user
    for (let attempt = 0; attempt < this.#attempts; attempt++) {
      const answer = await this.#sidecar.ask(shape, {
        system: PROMPTS.system,
        user: request,
        toolName,
        toolDescription: `Answer by calling ${toolName}.`,
      })
      if (answer.ok) return answer.value

      this.#problems.push({ task: toolName, error: answer.error })
      if (answer.error.code !== 'invalid-arguments') return undefined
      // say exactly what was wrong and let it try once more
      request = `${user}\n\nYour last call was rejected:\n${answer.error.violations
        .map((v) => `- ${v.path}: ${v.message}`)
        .join('\n')}\nCall the tool again, fixing exactly those fields.`
    }
    return undefined
  }
}

/** The abstract world, written out for the quest writer to read. */
function describePlaces(summary: WorldSummary): string {
  const lines = summary.places
    .filter((place) => place.npcs.length > 0 || place.items.length > 0)
    .map((place) => {
      const people = place.npcs.map((n) => `${n.name} (${n.role}, ${n.npcId})`).join('; ') || 'nobody'
      const things =
        place.items.map((i) => `${i.name} (${i.itemId}${i.ownerNpcId ? `, owned by ${i.ownerNpcId}` : ''})`).join('; ') ||
        'nothing'
      return `- ${place.name}, a ${place.kind} (${place.plotId})\n    people: ${people}\n    things: ${things}`
    })
  return lines.join('\n')
}

function fill(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}
