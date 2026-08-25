import type { QuestEntry, QuestStatus, QuestStep, QuestStepState } from '../types.ts'

/**
 * Reading a quest page whichever shape it arrived in. The game may send a
 * journal page from the quest engine as it stands, or the shorter form the
 * quests tab has always taken, and both read the same here.
 */
export function titleOf(quest: QuestEntry): string {
  return quest.questTitle ?? quest.title ?? ''
}

/** A page that says nothing about its status is a quest under way. */
export function statusOf(quest: QuestEntry): QuestStatus {
  return quest.status ?? 'active'
}

/**
 * The story first, then the errands, each group in the order the game sent it.
 * A player with nine errands running should not have to hunt for the main line.
 */
export function storyFirst(quests: readonly QuestEntry[]): readonly QuestEntry[] {
  return [...quests].sort((a, b) => rank(a) - rank(b))
}

function rank(quest: QuestEntry): number {
  return quest.kind === 'main' ? 0 : 1
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
