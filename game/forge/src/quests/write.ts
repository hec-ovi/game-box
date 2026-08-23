import type { Rng } from '@gb/kit'
import { questDraftContract, sealQuest } from '@gb/quest'
import type { WorldSummary } from '../narrator.ts'
import { flavourOf, type Flavour } from '../theme/flavour.ts'
import { CityCast } from './cast.ts'
import { MainLine, standing, type Link } from './line.ts'
import { RECIPES, type Job, type Recipe } from './recipes/index.ts'
import { questId, type Draft } from './shape.ts'

/**
 * How much of a town's side work is on the board before the player has done
 * anything.
 *
 * A town opens about one door in eight, so what a fresh player meets is not a
 * share of the quest list, it is how many of the doors they can actually walk
 * into have somebody with something to say. Three quarters of the side work up
 * front puts that at about a third of them, so the third or fourth place you
 * try has a job in it. The rest, and most of the main line, is still behind the
 * ladder.
 */
const OPENING = 0.75

/** The fewest a town puts up front, however little work it has. */
const FREE_SIDES = 2

/**
 * Writes a town's quests: a main line out of its busiest place that forks into
 * the town's own argument, then side work gated behind how far along that line
 * the player is. Every quest is written by a recipe over people and things the
 * town actually holds, and nothing is promised to two quests at once.
 *
 * Where the town has a premise, the main line is about what the premise put at
 * stake and the two sides it named; side work is the town's own errands either
 * way.
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
    const line = new MainLine(cast, plan, summary.premise)
    const drafts: Draft[] = []

    let tier = 0
    // one rung at a time, and a rung nobody can write is where the line stops: if
    // one side of a fork cannot be written, neither side is, so a player on either
    // branch always has the same ladder in front of them
    for (const rung of rungs(line.links)) {
      const written = rung.map(({ label, tier: _, ...link }, i) =>
        this.#one(cast, this.#rng.fork(label), flavour, { ...link, id: questId(drafts.length + 1 + i) }),
      )
      if (written.some((draft) => draft === undefined)) break
      for (const draft of written) drafts.push(draft!)
      tier = rung[0]!.tier
    }

    const opening = Math.max(FREE_SIDES, Math.round(sideQuests * OPENING))
    for (let i = 0; i < sideQuests; i++) {
      const rng = this.#rng.fork(`side/${i}`)
      const gate = tier > 0 && i >= opening ? rng.weighted(gates(tier)) : 0
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
    for (const recipe of order(cast, rng, flavour, job)) {
      const draft = recipe.write(cast, rng.fork(recipe.name), job)
      if (draft) return draft
    }
    return undefined
  }
}

/** The recipes a town can serve, shuffled by their odds in a town like this. */
function order(cast: CityCast, rng: Rng, flavour: Flavour, job: Job): Recipe[] {
  const left = RECIPES.filter((recipe) => (job.against ? recipe.takesSides : job.kind !== 'main' || recipe.leads))
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

/** The main line by rung: one link on the way up to the fork, one per side after it. */
function rungs(links: readonly Link[]): Link[][] {
  const byTier = new Map<number, Link[]>()
  for (const link of links) byTier.set(link.tier, [...(byTier.get(link.tier) ?? []), link])
  return [...byTier.keys()].sort((a, b) => a - b).map((tier) => byTier.get(tier)!)
}

/** Where the work that is not on the board yet sits: evenly up the rungs of the main line. */
function gates(tiers: number): ReadonlyArray<readonly [number, number]> {
  return Array.from({ length: tiers }, (_, tier) => [tier + 1, 1] as const)
}
