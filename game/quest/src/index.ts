/** @gb/quest: quests as flows, checked before they are accepted and run from game events. See CONTRACT.md. */
export { validateQuest, checkFlow, type QuestError } from './validate.ts'
export type { QuestProblem } from './problem.ts'
export { QuestLog, type Change, type FailReason, type Objective, type RuntimeError } from './runtime.ts'
export { questProgressContract, type QuestProgressDoc, type QuestStatus } from './progress.ts'
export { gameEventContract, type GameEvent } from './events.ts'
export { DIFFICULTIES, REWARD_TABLE, checkReward, rewardFor, type Difficulty, type RewardBand } from './balance.ts'
export type { WorldView } from './world-view.ts'
export {
  questContract,
  questDraftContract,
  sealQuest,
  type QuestDoc,
  type QuestDraft,
  type Step,
  type StepKind,
  type Condition,
  type Effect,
  type FailRule,
  type Place,
  type Reward,
} from './schema.ts'
