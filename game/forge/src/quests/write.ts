import type { Rng } from '@gb/kit'
import { questDraftContract, sealQuest } from '@gb/quest'
import type { WorldSummary } from '../narrator.ts'
import { flavourOf, type Flavour } from '../theme/flavour.ts'
import { CityCast } from './cast.ts'
import { RECIPES, type Job, type Recipe } from './recipes/index.ts'
import { questId, type Draft } from './shape.ts'

/** The longest main line a generated town gets. */
const MOST_MAIN = 4

/** How many people a town needs before its main line grows another link. */
const PER_LINK = 6

/** Side jobs that are going before the player has done anything at all. */
const FREE_SIDES = 2

/** The flag a finished main-line quest raises. Side work waits on these. */
const standing = (tier: number): string => `standing_${tier}`

/**
 * Writes a town's quests: a short main line out of its busiest place, then side
 * work gated behind how far along that line the player is. Every quest is
 * written by a recipe over people and things the town actually holds, and
 * nothing is promised to two quests at once.
 */
export class QuestWriter {
  #rng: Rng

  constructor(rng: Rng) {
    this.#rng = rng
  }

  write(summary: WorldSummary, sideQuests: number): unknown[] {
    const flavour = flavourOf(summary.theme)
    const cast = new CityCast(summary)
    const plan = this.#rng.fork('plan')
    const hub = cast.hub(plan)
    const drafts: Draft[] = []

    let tier = 0
    const wanted = hub ? Math.min(MOST_MAIN, 1 + Math.floor(cast.peopled.length / PER_LINK) + plan.int(0, 2)) : 0
    for (let i = 0; i < wanted; i++) {
      const draft = this.#one(cast, this.#rng.fork(`main/${i}`), flavour, {
        id: questId(drafts.length + 1),
        kind: 'main',
        requires: tier === 0 ? [] : [{ kind: 'flag', flag: standing(tier), value: true }],
        grants: standing(tier + 1),
        ...(hub ? { from: hub } : {}),
      })
      if (!draft) break
      drafts.push(draft)
      tier++
    }

    for (let i = 0; i < sideQuests; i++) {
      const rng = this.#rng.fork(`side/${i}`)
      const gate = tier > 0 && i >= FREE_SIDES ? rng.weighted(gates(tier)) : 0
      const draft = this.#one(cast, rng, flavour, {
        id: questId(drafts.length + 1),
        kind: 'side',
        requires: gate === 0 ? [] : [{ kind: 'flag', flag: standing(gate), value: true }],
      })
      if (!draft) break
      drafts.push(draft)
    }

    return drafts.map((draft) => {
      const parsed = questDraftContract.parse(draft)
      // a draft the door refuses is handed on as it is, so the forge reports it rather than hiding it
      return parsed.ok ? sealQuest(parsed.value) : draft
    })
  }

  /** Tries the recipes this town can serve, best odds first, until one writes. */
  #one(cast: CityCast, rng: Rng, flavour: Flavour, job: Job): Draft | undefined {
    for (const recipe of order(cast, rng, flavour, job.kind === 'main')) {
      const draft = recipe.write(cast, rng.fork(recipe.name), job)
      if (draft) return draft
    }
    return undefined
  }
}

/** The recipes a town can serve, shuffled by their odds in a town like this. */
function order(cast: CityCast, rng: Rng, flavour: Flavour, leading: boolean): Recipe[] {
  const left = RECIPES.filter((recipe) => !leading || recipe.leads)
    .map((recipe) => [recipe, recipe.weight(cast, flavour)] as const)
    .filter(([, weight]) => weight > 0)

  const picked: Recipe[] = []
  while (left.length) {
    const recipe = rng.weighted(left)
    picked.push(recipe)
    left.splice(
      left.findIndex(([candidate]) => candidate === recipe),
      1,
    )
  }
  return picked
}

/** How side work spreads over the main line: about a third up front, the rest behind it. */
function gates(tiers: number): ReadonlyArray<readonly [number, number]> {
  return Array.from({ length: tiers + 1 }, (_, tier) => [tier, tier === 0 ? tiers : 2] as const)
}
