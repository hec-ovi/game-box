import type { QuestStep, QuestStepState } from '../types.ts'

/**
 * What a step is, from whichever shape the game sent: `state` when it says so,
 * and `done` on its own reads as finished or open.
 */
export function stateOf(step: QuestStep): QuestStepState {
  return step.state ?? (step.done ? 'done' : 'open')
}

/** The glyph in front of the step. Only the one the player can act on is loud. */
export const STEP_MARK: Record<QuestStepState, string> = {
  upcoming: '·',
  open: '▸',
  done: '✓',
}
