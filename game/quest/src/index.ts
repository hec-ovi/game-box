/** @gb/quest: quests as flows, checked before they are accepted and run from game events. See CONTRACT.md. */
export { validateQuest, checkFlow, type QuestError } from './validate.ts'
export type { QuestProblem } from './problem.ts'
export { QuestLog, type Change, type Objective, type RuntimeError } from './runtime.ts'
export type { JournalEntry, JournalStep, StepState } from './journal.ts'
export type { QuestTimer } from './timer.ts'
export type { StepLine } from './step-line.ts'
export type { Choice, ChoiceOption } from './choice.ts'
export type { ObjectiveTarget } from './target.ts'
export { FAIL_REASONS, questProgressContract, type FailReason, type QuestProgressDoc, type QuestStatus } from './progress.ts'
export { gameEventContract, type GameEvent } from './events.ts'
export { DIFFICULTIES, REWARD_TABLE, checkReward, rewardFor, type Difficulty, type RewardBand } from './balance.ts'
export type { Access, CarModel } from './reward.ts'
export type { WorldView } from './world-view.ts'
export { questDraftContract, sealQuest, type QuestDraft } from './draft.ts'
export {
  questContract,
  type QuestDoc,
  type Step,
  type StepKind,
  type QuestKind,
  type Condition,
  type Effect,
  type FailRule,
  type Place,
  type Reward,
} from './schema.ts'
