import type { PlayerState } from '@gb/play'
import type { QuestLog, QuestDoc } from '@gb/quest'

/** Which branch of a choice the player takes, when a quest offers one. */
export type Choose = (options: ReadonlyArray<{ id: string }>) => number

/**
 * Plays one quest the way the game would: read the open objectives, do what
 * each one asks, and keep going until the quest is over or nothing moves.
 * It knows nothing about how the quest was written, so it is the same driver
 * whatever recipe produced it.
 */
export function playThrough(quest: QuestDoc, log: QuestLog, player: PlayerState, choose: Choose = () => 0): string | undefined {
  const steps = new Map(quest.steps.map((step) => [step.id, step]))
  const held = new Set<string>()

  for (let round = 0; round < 60; round++) {
    const open = log.objectives().filter((objective) => objective.questId === quest.id)
    if (!open.length) break
    let moved = false

    for (const objective of open) {
      const step = steps.get(objective.stepId)
      if (!step) continue
      moved = act(step, quest, log, player, held, choose) || moved
      if (log.status(quest.id) !== 'active') return log.status(quest.id)
    }
    if (!moved) break
  }
  return log.status(quest.id)
}

/** Does whatever one open step is asking for. */
function act(
  step: QuestDoc['steps'][number],
  quest: QuestDoc,
  log: QuestLog,
  player: PlayerState,
  held: Set<string>,
  choose: Choose,
): boolean {
  switch (step.kind) {
    case 'talk':
      return changed(log.handle({ kind: 'talked', npcId: step.npcId, ...(step.topic ? { topic: step.topic } : {}) }))
    case 'goto':
    case 'escort':
      return changed(log.handle({ kind: 'arrived', place: step.place }))
    case 'collect': {
      let moved = false
      for (const itemId of pool(step).slice(0, step.count ?? 1)) {
        if (held.has(itemId)) continue
        player.take(itemId, { stolen: step.allowSteal })
        held.add(itemId)
        moved = changed(log.handle({ kind: 'acquired', itemId, stolen: step.allowSteal })) || moved
      }
      return moved
    }
    case 'deliver': {
      let moved = false
      for (const itemId of pool(step).filter((id) => held.has(id)).slice(0, step.count ?? 1)) {
        moved = changed(log.handle({ kind: 'gave', itemId, npcId: step.toNpcId })) || moved
      }
      return moved
    }
    case 'stash':
      return changed(log.handle({ kind: 'stashed', itemId: step.itemId, interiorId: step.interiorId, anchorId: step.anchorId }))
    case 'choice': {
      const option = step.options[choose(step.options) % step.options.length]!
      return changed(log.handle({ kind: 'chose', questId: quest.id, stepId: step.id, optionId: option.id }))
    }
    default:
      return false
  }
}

/** Every item that satisfies a step: the one it names plus anything interchangeable. */
function pool(step: { itemId: string; alternates?: readonly string[] | undefined }): string[] {
  return [step.itemId, ...(step.alternates ?? [])]
}

function changed(result: ReturnType<QuestLog['handle']>): boolean {
  return result.ok && result.value.length > 0
}
