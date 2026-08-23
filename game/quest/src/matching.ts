import type { PlayerState } from '@gb/play'
import type { GameEvent } from './events.ts'
import { itemPool, type FailRule, type Place, type Step } from './schema.ts'

export interface StepMatch {
  /** The item this event counts towards a step that wants several. */
  readonly credit?: string
}

/** Whether an event is the thing this step was waiting for. */
export function matchStep(input: {
  step: Step
  event: GameEvent
  questId: string
  player: PlayerState
  credited: ReadonlySet<string>
}): StepMatch | undefined {
  const { step, event, questId, player, credited } = input
  switch (step.kind) {
    case 'talk':
      return event.kind === 'talked' && event.npcId === step.npcId && (!step.topic || step.topic === event.topic) ? {} : undefined
    case 'goto':
      return event.kind === 'arrived' && samePlace(step.place, event.place) ? {} : undefined
    case 'collect':
      if (event.kind !== 'acquired' || (event.stolen && !step.allowSteal)) return undefined
      return credit(step, event.itemId, credited)
    case 'deliver':
      if (event.kind !== 'gave' || event.npcId !== step.toNpcId) return undefined
      return credit(step, event.itemId, credited)
    case 'stash':
      if (event.kind !== 'stashed' || event.interiorId !== step.interiorId || event.anchorId !== step.anchorId) return undefined
      return credit(step, event.itemId, credited)
    case 'escort':
      return event.kind === 'arrived' && samePlace(step.place, event.place) && player.isCompanion(step.npcId) ? {} : undefined
    case 'choice':
      if (event.kind !== 'chose' || event.questId !== questId || event.stepId !== step.id) return undefined
      // only a road the step published: anything else would finish the step and open nothing
      return step.options.some((option) => option.id === event.optionId) ? {} : undefined
    default:
      return undefined
  }
}

/** Whether this event is the thing that ends the quest badly. */
export function triggersFailure(rule: FailRule, event: GameEvent, elapsed: number): boolean {
  switch (rule.kind) {
    case 'time-limit':
      return event.kind === 'clock' && elapsed >= rule.seconds
    case 'npc-lost':
      return event.kind === 'npc-gone' && event.npcId === rule.npcId && (!rule.reason || rule.reason === event.reason)
    case 'item-lost':
      return event.kind === 'item-destroyed' && event.itemId === rule.itemId
  }
}

export function samePlace(a: Place, b: Place): boolean {
  if ('plotId' in a && 'plotId' in b) return a.plotId === b.plotId
  if ('interiorId' in a && 'interiorId' in b) return a.interiorId === b.interiorId
  return false
}

function credit(step: Step, itemId: string, credited: ReadonlySet<string>): StepMatch | undefined {
  if (credited.has(itemId) || !itemPool(step).has(itemId)) return undefined
  return { credit: itemId }
}
