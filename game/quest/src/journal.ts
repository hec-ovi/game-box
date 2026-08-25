import type { Flow } from './graph.ts'
import { isSecret, type FailReason, type Progress, type QuestStatus } from './progress.ts'
import { resolvesItself, type QuestDoc, type QuestKind, type Step } from './schema.ts'
import { stepLine, type StepLine } from './step-line.ts'
import { timerOf, type QuestTimer } from './timer.ts'

/**
 * Where one step stands. `dropped` is a branch nobody took: the flow can no
 * longer reach it, so it is neither work still to come nor work that was done.
 */
export type StepState = 'upcoming' | 'open' | 'done' | 'dropped'

/** A step on the journal page: the same line an objective shows, plus where it stands. */
export interface JournalStep extends StepLine {
  readonly state: StepState
}

/** One quest's page: its steps in the order the quest was written. */
export interface JournalEntry {
  readonly questId: string
  readonly questTitle: string
  /** The story line or an errand, so the page can say which this is. */
  readonly kind: QuestKind
  readonly status: QuestStatus
  /** Why it ended badly. On the page exactly while `status` is `failed`. */
  readonly failReason?: FailReason
  /** The countdown, in game seconds, while a timed quest is being played. */
  readonly timer?: QuestTimer
  readonly steps: readonly JournalStep[]
}

/**
 * Reads one quest the way a journal page does: every step the player does,
 * in document order, each saying where it stands. A step the flow can still
 * walk into is `upcoming`; one it cannot is `dropped`, which is what the far
 * side of a choice becomes once the player went the other way, and what a
 * rival branch becomes once an any-of has a winner. Secrets stay off the page
 * until something reveals them, and the steps that resolve themselves are
 * never on it at all. A page that ended badly says why, and a timed page that
 * is still being played says how long is left.
 */
export class QuestJournal {
  readonly #quest: QuestDoc
  readonly #flow: Flow
  readonly #progress: Progress
  readonly #clock: number

  constructor(quest: QuestDoc, flow: Flow, progress: Progress, clock: number) {
    this.#quest = quest
    this.#flow = flow
    this.#progress = progress
    this.#clock = clock
  }

  entry(): JournalEntry {
    const ahead = this.#stillAhead()
    const steps: JournalStep[] = []
    for (const step of this.#quest.steps) {
      if (resolvesItself(step) || isSecret(step, this.#progress)) continue
      steps.push({ ...stepLine(step, this.#progress), state: this.#stateOf(step, ahead) })
    }
    const { id, title, kind } = this.#quest
    const { status, failReason } = this.#progress
    const timer = status === 'active' ? timerOf(this.#quest, this.#progress, this.#clock) : undefined
    return {
      questId: id,
      questTitle: title,
      kind,
      status,
      ...(failReason ? { failReason } : {}),
      ...(timer ? { timer } : {}),
      steps,
    }
  }

  #stateOf(step: Step, ahead: ReadonlySet<string>): StepState {
    if (this.#progress.done.has(step.id)) return 'done'
    if (this.#progress.open.has(step.id)) return 'open'
    return ahead.has(step.id) ? 'upcoming' : 'dropped'
  }

  /** Everything the flow can still walk into from where the player is standing. */
  #stillAhead(): ReadonlySet<string> {
    const ahead = new Set<string>()
    for (const stepId of this.#progress.open) for (const reached of this.#flow.reachable(stepId)) ahead.add(reached)
    return ahead
  }
}
