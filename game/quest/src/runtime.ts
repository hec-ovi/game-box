import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import type { PlayerState } from '@gb/play'
import { applyEffects, meets, payReward, unmet } from './apply.ts'
import { gameEventContract, type GameEvent } from './events.ts'
import { Flow } from './graph.ts'
import { matchStep, triggersFailure } from './matching.ts'
import { freshProgress, questProgressContract, restoreProgress, storeProgress, type Progress, type QuestProgressDoc, type QuestStatus } from './progress.ts'
import { countOf, isHiddenStep, isOptional, itemPool, type Condition, type Place, type QuestDoc, type Reward, type Step } from './schema.ts'

export type RuntimeError =
  | { readonly code: 'unknown-quest'; readonly questId: string }
  | { readonly code: 'already-started'; readonly questId: string }
  | { readonly code: 'requirements-not-met'; readonly questId: string; readonly unmet: readonly Condition[] }
  | { readonly code: 'invalid-event'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'invalid-progress'; readonly violations: readonly SchemaViolation[] }

/** Why a quest ended badly. */
export type FailReason = 'fail-step' | 'time-limit' | 'npc-lost' | 'item-lost'

export type Change =
  | { readonly kind: 'quest-started'; readonly questId: string }
  | {
      readonly kind: 'step-opened'
      readonly questId: string
      readonly stepId: string
      readonly objective: string
      /** True while the step is on the board but not yet shown to the player. */
      readonly hidden: boolean
    }
  | { readonly kind: 'step-revealed'; readonly questId: string; readonly stepId: string; readonly objective: string }
  | { readonly kind: 'step-progress'; readonly questId: string; readonly stepId: string; readonly done: number; readonly needed: number }
  | { readonly kind: 'step-done'; readonly questId: string; readonly stepId: string }
  | { readonly kind: 'step-abandoned'; readonly questId: string; readonly stepId: string }
  | { readonly kind: 'quest-complete'; readonly questId: string; readonly reward: Reward }
  | { readonly kind: 'quest-failed'; readonly questId: string; readonly reason: FailReason }

export interface Objective {
  readonly questId: string
  readonly questTitle: string
  readonly stepId: string
  readonly text: string
  /** Short label for the world marker, when the objective line is too long for it. */
  readonly markerLabel?: string
  /** A nudge to show if the player stalls. */
  readonly hint?: string
  readonly place?: Place
  readonly npcId?: string
  /** Side work: the quest finishes without it. Absent means it is required. */
  readonly optional?: boolean
  /** How far along a step that wants several things is, for a "3/5" in the interface. */
  readonly count?: { readonly done: number; readonly needed: number }
}

/**
 * Runs quest flows: opens the next steps when one is done, counts what the
 * player brings in, applies what a step changes, drops the branches a rival
 * branch beat, and hands out the reward at the end. It is driven entirely by
 * events the game reports, so it can be played through without a renderer.
 */
export class QuestLog {
  #quests: Map<string, QuestDoc>
  #flows = new Map<string, Flow>()
  #progress: Map<string, Progress>
  #player: PlayerState
  /** Seconds of play, as last reported by the game. Time limits count from here. */
  #clock = 0

  private constructor(quests: readonly QuestDoc[], player: PlayerState, progress: Map<string, Progress>) {
    this.#quests = new Map(quests.map((q) => [q.id, q]))
    this.#player = player
    this.#progress = progress
  }

  static create(quests: readonly QuestDoc[], player: PlayerState): QuestLog {
    return new QuestLog(quests, player, new Map(quests.map((q) => [q.id, freshProgress()])))
  }

  /** Resume a playthrough. Quests must be the same validated set the save was made with. */
  static load(value: unknown, quests: readonly QuestDoc[], player: PlayerState): Result<QuestLog, RuntimeError> {
    const parsed = questProgressContract.parse(value)
    if (!parsed.ok) return err({ code: 'invalid-progress', violations: parsed.error })

    const progress = new Map<string, Progress>()
    for (const quest of quests) progress.set(quest.id, restoreProgress(parsed.value.quests[quest.id]))
    return ok(new QuestLog(quests, player, progress))
  }

  quests(): readonly QuestDoc[] {
    return [...this.#quests.values()]
  }

  status(questId: string): QuestStatus | undefined {
    return this.#progress.get(questId)?.status
  }

  /** Quests this NPC can offer right now, standing and belongings included. */
  offeredBy(npcId: string): readonly QuestDoc[] {
    return this.quests().filter(
      (quest) => quest.giverNpcId === npcId && this.status(quest.id) === 'unstarted' && meets(this.#player, quest.requires ?? []),
    )
  }

  start(questId: string): Result<readonly Change[], RuntimeError> {
    const quest = this.#quests.get(questId)
    if (!quest) return err({ code: 'unknown-quest', questId })
    const progress = this.#progress.get(questId)!
    if (progress.status !== 'unstarted') return err({ code: 'already-started', questId })

    const missing = unmet(this.#player, quest.requires ?? [])
    if (missing.length) return err({ code: 'requirements-not-met', questId, unmet: missing })

    progress.status = 'active'
    progress.startedAt = this.#clock
    const changes: Change[] = [{ kind: 'quest-started', questId }]
    this.#openSteps(quest, progress, [quest.startStepId], changes)
    return ok(changes)
  }

  /** Report something the player did, or something the world did. Returns everything that moved. */
  handle(event: unknown): Result<readonly Change[], RuntimeError> {
    const parsed = gameEventContract.parse(event)
    if (!parsed.ok) return err({ code: 'invalid-event', violations: parsed.error })
    if (parsed.value.kind === 'clock') this.#clock = parsed.value.seconds

    const changes: Change[] = []
    this.#checkFailures(parsed.value, changes)

    for (const quest of this.#quests.values()) {
      const progress = this.#progress.get(quest.id)!
      if (progress.status !== 'active') continue
      for (const stepId of [...progress.open]) {
        if (progress.status !== 'active') break
        const step = this.#flow(quest).step(stepId)
        if (!step) continue
        this.#advance(quest, progress, step, parsed.value, changes)
      }
    }
    return ok(changes)
  }

  /**
   * True while some live quest still needs this item. Being a quest item is a
   * binding from a quest, not a property of the thing, so the same ledger can
   * be untouchable in one playthrough and ordinary loot in another.
   */
  isQuestItem(itemId: string): boolean {
    for (const quest of this.#quests.values()) {
      const progress = this.#progress.get(quest.id)!
      if (progress.status !== 'active') continue
      for (const step of quest.steps) {
        if (progress.done.has(step.id) || progress.abandoned.has(step.id)) continue
        if (itemPool(step).has(itemId)) return true
        if ('itemId' in step && step.itemId === itemId) return true
        if (step.effects.some((e) => 'itemId' in e && e.itemId === itemId)) return true
        if (step.requires.some((c) => 'itemId' in c && c.itemId === itemId)) return true
      }
      if (quest.reward.items.includes(itemId)) return true
    }
    return false
  }

  /** What the HUD and the journal show right now. Hidden steps stay out until they are revealed. */
  objectives(): readonly Objective[] {
    const out: Objective[] = []
    for (const quest of this.#quests.values()) {
      const progress = this.#progress.get(quest.id)!
      if (progress.status !== 'active') continue
      for (const stepId of progress.open) {
        const step = this.#flow(quest).step(stepId)
        if (!step || this.#isHidden(progress, step)) continue
        out.push({
          questId: quest.id,
          questTitle: quest.title,
          stepId: step.id,
          text: step.objective,
          ...(isOptional(step) ? { optional: true } : {}),
          ...(step.markerLabel ? { markerLabel: step.markerLabel } : {}),
          ...(step.hint ? { hint: step.hint } : {}),
          ...('place' in step ? { place: step.place } : {}),
          ...('npcId' in step ? { npcId: step.npcId } : {}),
          ...this.#countProgress(progress, step),
        })
      }
    }
    return out
  }

  toJSON(): QuestProgressDoc {
    const quests: QuestProgressDoc['quests'] = {}
    for (const [questId, progress] of this.#progress) quests[questId] = storeProgress(progress)
    return { format: 'game-box.quest-progress', schemaVersion: 1, quests }
  }

  #flow(quest: QuestDoc): Flow {
    const known = this.#flows.get(quest.id)
    if (known) return known
    const flow = new Flow(quest)
    this.#flows.set(quest.id, flow)
    return flow
  }

  #advance(quest: QuestDoc, progress: Progress, step: Step, event: GameEvent, changes: Change[]): void {
    const credited = progress.credited.get(step.id) ?? new Set<string>()
    const match = matchStep({ step, event, questId: quest.id, player: this.#player, credited })
    if (!match || !meets(this.#player, step.requires)) return

    if (match.credit !== undefined) {
      credited.add(match.credit)
      progress.credited.set(step.id, credited)
      const needed = countOf(step)
      if (credited.size < needed) {
        changes.push({ kind: 'step-progress', questId: quest.id, stepId: step.id, done: credited.size, needed })
        return
      }
    }
    const chosen = event.kind === 'chose' ? event.optionId : undefined
    this.#finishStep(quest, progress, step, chosen, changes)
  }

  #checkFailures(event: GameEvent, changes: Change[]): void {
    for (const quest of this.#quests.values()) {
      const progress = this.#progress.get(quest.id)!
      if (progress.status !== 'active') continue
      const elapsed = this.#clock - progress.startedAt
      const rule = (quest.failWhen ?? []).find((candidate) => triggersFailure(candidate, event, elapsed))
      if (rule) this.#failQuest(quest, progress, rule.kind, changes)
    }
  }

  #finishStep(quest: QuestDoc, progress: Progress, step: Step, chosenOptionId: string | undefined, changes: Change[]): void {
    progress.open.delete(step.id)
    progress.done.add(step.id)
    changes.push({ kind: 'step-done', questId: quest.id, stepId: step.id })

    applyEffects(this.#player, step.effects)
    for (const effect of step.effects) if (effect.kind === 'reveal') this.#reveal(quest, progress, effect.stepId, changes)

    if (step.kind === 'complete') {
      progress.status = 'complete'
      progress.open.clear()
      payReward(this.#player, quest.reward)
      changes.push({ kind: 'quest-complete', questId: quest.id, reward: quest.reward })
      return
    }
    if (step.kind === 'fail') {
      this.#failQuest(quest, progress, 'fail-step', changes)
      return
    }
    if (step.kind === 'any-of') this.#abandonRivals(quest, progress, step.id, changes)

    const next = step.kind === 'choice' ? step.options.filter((o) => o.id === chosenOptionId).map((o) => o.next) : step.next
    this.#openSteps(quest, progress, next, changes)
  }

  /** Opens steps, and runs straight through the ones that need no player action. */
  #openSteps(quest: QuestDoc, progress: Progress, stepIds: readonly string[], changes: Change[]): void {
    const flow = this.#flow(quest)
    for (const stepId of stepIds) {
      if (progress.done.has(stepId) || progress.open.has(stepId) || progress.abandoned.has(stepId)) continue
      const step = flow.step(stepId)
      if (!step) continue
      if (step.kind === 'join' && !step.waitFor.every((id) => progress.done.has(id))) continue
      if (step.kind === 'any-of' && !step.oneOf.some((id) => progress.done.has(id))) continue

      progress.open.add(step.id)
      changes.push({
        kind: 'step-opened',
        questId: quest.id,
        stepId: step.id,
        objective: step.objective,
        hidden: this.#isHidden(progress, step),
      })

      if (step.kind === 'join' || step.kind === 'any-of' || step.kind === 'complete' || step.kind === 'fail') {
        this.#finishStep(quest, progress, step, undefined, changes)
        if (progress.status !== 'active') return
      }
    }

    // a branch finishing may be the last one a join was waiting for
    const waiting = quest.steps.filter(
      (step) =>
        step.kind === 'join' &&
        !progress.done.has(step.id) &&
        !progress.open.has(step.id) &&
        !progress.abandoned.has(step.id) &&
        step.waitFor.every((id) => progress.done.has(id)),
    )
    if (waiting.length) this.#openSteps(quest, progress, waiting.map((step) => step.id), changes)
  }

  /** One branch of an any-of got there first, so every step still walking a rival branch is dropped. */
  #abandonRivals(quest: QuestDoc, progress: Progress, anyOfStepId: string, changes: Change[]): void {
    const ancestors = this.#flow(quest).ancestorsOf(anyOfStepId)
    for (const stepId of [...progress.open]) {
      if (!ancestors.has(stepId)) continue
      progress.open.delete(stepId)
      progress.abandoned.add(stepId)
      changes.push({ kind: 'step-abandoned', questId: quest.id, stepId })
    }
  }

  #reveal(quest: QuestDoc, progress: Progress, stepId: string, changes: Change[]): void {
    if (progress.revealed.has(stepId)) return
    progress.revealed.add(stepId)
    const step = this.#flow(quest).step(stepId)
    if (step && progress.open.has(stepId)) {
      changes.push({ kind: 'step-revealed', questId: quest.id, stepId, objective: step.objective })
    }
  }

  #failQuest(quest: QuestDoc, progress: Progress, reason: FailReason, changes: Change[]): void {
    progress.status = 'failed'
    progress.open.clear()
    changes.push({ kind: 'quest-failed', questId: quest.id, reason })
  }

  #isHidden(progress: Progress, step: Step): boolean {
    return isHiddenStep(step) && !progress.revealed.has(step.id)
  }

  #countProgress(progress: Progress, step: Step): { count?: { done: number; needed: number } } {
    const needed = countOf(step)
    if (needed <= 1) return {}
    return { count: { done: progress.credited.get(step.id)?.size ?? 0, needed } }
  }
}
