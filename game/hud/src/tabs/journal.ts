import type { QuestEntry, QuestStep, QuestStepState } from '../types.ts'

/**
 * Reading a quest page whichever shape it arrived in. The game may send a
 * journal page from the quest engine as it stands, or the shorter form the
 * quests tab has always taken, and both read the same here.
 */
export function titleOf(quest: QuestEntry): string {
  return quest.questTitle ?? quest.title ?? ''
}

/** What a step is: `state` when the game says so, `done` on its own otherwise. */
export function stateOf(step: QuestStep): QuestStepState {
  return step.state ?? (step.done ? 'done' : 'open')
}

/** The glyph in front of the step. Only the one the player can act on is loud. */
export const STEP_MARK: Record<QuestStepState, string> = {
  upcoming: '·',
  open: '▸',
  done: '✓',
  dropped: '×',
}

/** Said in words where a glyph is not enough: the road the quest did not take. */
export const DROPPED_TAG = 'Not taken'
