import type { Progress } from './progress.ts'
import type { QuestDoc } from './schema.ts'

/** Where a timed quest's clock stands, in game seconds: the unit the `clock` event carries. */
export interface QuestTimer {
  /** Game seconds left before the quest fails. Zero once it has run out. */
  readonly remaining: number
  /** Game seconds the quest was given when it was taken. */
  readonly total: number
}

/** The tightest `time-limit` a quest carries, or nothing when it is not timed. */
export function timeLimitOf(quest: QuestDoc): number | undefined {
  const limits = (quest.failWhen ?? []).flatMap((rule) => (rule.kind === 'time-limit' ? [rule.seconds] : []))
  return limits.length ? Math.min(...limits) : undefined
}

/**
 * The countdown as the interface shows it: what was granted, and what is left
 * of it against the clock the game last reported. A save resumed before the
 * next tick reads the clock at zero, so the remainder is held inside the grant
 * rather than reading as more time than the quest ever had.
 */
export function timerOf(quest: QuestDoc, progress: Progress, clock: number): QuestTimer | undefined {
  const total = timeLimitOf(quest)
  if (total === undefined) return undefined
  const elapsed = clock - progress.startedAt
  return { remaining: Math.min(total, Math.max(0, total - elapsed)), total }
}
