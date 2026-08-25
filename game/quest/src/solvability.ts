import type { Flow } from './graph.ts'
import { Held } from './held.ts'
import type { Report } from './problem.ts'
import { countOf, itemPool, type QuestDoc, type Step } from './schema.ts'

/**
 * Walks the flow forward working out what the player is guaranteed to be
 * holding when each step opens. A quest that asks for something the player
 * cannot have yet is rejected before anyone is allowed to accept it.
 */
export function checkSolvability(quest: QuestDoc, flow: Flow, order: readonly string[], report: Report): void {
  const after = new Map<string, Held>()

  for (const id of order) {
    const step = flow.step(id)!
    const before = entryState(quest, flow, step, after)

    if (step.kind === 'deliver' || step.kind === 'stash') {
      const pool = itemPool(step)
      const held = before.available(pool)
      const wanted = countOf(step)
      if (held < wanted) {
        const what = wanted === 1 ? step.itemId : `${wanted} of ${step.itemId} and its alternates`
        report(step.id, `asks for ${what} before the player is guaranteed to have it (sure of ${held})`)
      }
    }
    if (step.kind === 'escort' && !before.hasCompanion(step.npcId)) {
      report(step.id, `escorts ${step.npcId}, who has not joined the player on every path here`)
    }
    for (const condition of step.requires) {
      if (condition.kind === 'has-item' && before.available(new Set([condition.itemId])) < 1) {
        report(step.id, `requires ${condition.itemId}, which is not guaranteed by this point`)
      }
      if (condition.kind === 'has-companion' && !before.hasCompanion(condition.npcId)) {
        report(step.id, `requires ${condition.npcId} as a companion, who has not joined by this point`)
      }
    }

    after.set(id, applyStep(step, before))
  }
}

function entryState(quest: QuestDoc, flow: Flow, step: Step, after: Map<string, Held>): Held {
  const predecessors = flow.predecessors.get(step.id) ?? []
  if (step.id === quest.startStepId || predecessors.length === 0) return Held.empty()

  // a join runs every branch, so the whole of any one of them still holds; every
  // other merge is one path out of several, so only the common ground counts
  const sources = step.kind === 'join' ? step.waitFor : step.kind === 'any-of' ? step.oneOf : predecessors
  const states = sources.map((id) => after.get(id)).filter((state): state is Held => state !== undefined)
  if (!states.length) return Held.empty()
  return Held.merge(states, step.kind === 'join' ? 'all' : 'any')
}

function applyStep(step: Step, before: Held): Held {
  const held = before.clone()

  if (step.kind === 'collect' || step.kind === 'buy') held.add(itemPool(step), countOf(step))
  if (step.kind === 'deliver' || step.kind === 'stash') held.consume(itemPool(step), countOf(step))
  for (const effect of step.effects) {
    if (effect.kind === 'give-item') held.add(new Set([effect.itemId]), 1)
    if (effect.kind === 'take-item') held.consume(new Set([effect.itemId]), 1)
    if (effect.kind === 'companion-join') held.addCompanion(effect.npcId)
    if (effect.kind === 'companion-leave') held.removeCompanion(effect.npcId)
  }
  return held
}
