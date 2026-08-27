import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { checkReward, difficultyOf, settle, type Difficulty } from './balance.ts'
import { checkEdges, checkShape } from './flow.ts'
import { Flow } from './graph.ts'
import type { QuestProblem } from './problem.ts'
import { checkReferences } from './references.ts'
import { questContract, type QuestDoc } from './schema.ts'
import { checkSolvability } from './solvability.ts'
import type { WorldView } from './world-view.ts'

export type QuestError =
  | { readonly code: 'invalid-quest'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'broken-flow'; readonly problems: readonly QuestProblem[] }
  | { readonly code: 'unbalanced-reward'; readonly difficulty: Difficulty; readonly violations: readonly SchemaViolation[] }

/**
 * Accept a quest only if it can actually be played: every step reachable, every
 * path ending, every person and thing it names present in the world, every item
 * in hand by the time the player is asked to hand it over, and pay that matches
 * the work.
 */
export function validateQuest(value: unknown, world: WorldView): Result<QuestDoc, QuestError> {
  const parsed = questContract.parse(value)
  if (!parsed.ok) return err({ code: 'invalid-quest', violations: parsed.error })

  const problems = checkFlow(parsed.value, world)
  if (problems.length) return err({ code: 'broken-flow', problems })

  // the pay is settled into its band rather than argued with: a number in the
  // wrong place is not a reason to throw a playable job away
  const quest = settle(parsed.value)
  const unbalanced = checkReward(quest)
  if (unbalanced.length) {
    return err({ code: 'unbalanced-reward', difficulty: difficultyOf(quest), violations: unbalanced })
  }
  return ok(quest)
}

/** Every reason this quest could not be played, not just the first. */
export function checkFlow(quest: QuestDoc, world: WorldView): QuestProblem[] {
  const problems: QuestProblem[] = []
  const report = (where: string, message: string) => void problems.push({ where, message })

  const flow = new Flow(quest)
  checkReferences(quest, world, report)
  if (!flow.steps.has(quest.startStepId)) {
    report(quest.id, `startStepId ${quest.startStepId} is not one of the steps`)
    return problems
  }

  checkEdges(quest, flow, report)
  if (problems.length) return problems

  const shape = checkShape(quest, flow, report)
  if (!shape) return problems

  checkSolvability(quest, flow, shape.order, report)
  return problems
}
