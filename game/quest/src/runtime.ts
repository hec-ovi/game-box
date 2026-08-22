import { contract, err, ok, type Result, type SchemaViolation } from '@gb/kit'
import type { PlayerState } from '@gb/play'
import { z } from 'zod'
import { gameEventContract, type GameEvent } from './events.ts'
import type { Condition, Effect, Place, QuestDoc, Reward, Step } from './schema.ts'

export const QuestProgressSchema = z.object({
  format: z.literal('game-box.quest-progress'),
  schemaVersion: z.literal(1),
  quests: z.record(
    z.string(),
    z.object({
      status: z.enum(['unstarted', 'active', 'complete', 'failed']),
      open: z.array(z.string()),
      done: z.array(z.string()),
    }),
  ),
})

export const questProgressContract = contract('quest-progress', QuestProgressSchema)
export type QuestProgressDoc = z.infer<typeof QuestProgressSchema>
export type QuestStatus = QuestProgressDoc['quests'][string]['status']

export type RuntimeError =
  | { readonly code: 'unknown-quest'; readonly questId: string }
  | { readonly code: 'already-started'; readonly questId: string }
  | { readonly code: 'invalid-event'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'invalid-progress'; readonly violations: readonly SchemaViolation[] }

export type Change =
  | { readonly kind: 'quest-started'; readonly questId: string }
  | { readonly kind: 'step-opened'; readonly questId: string; readonly stepId: string; readonly objective: string }
  | { readonly kind: 'step-done'; readonly questId: string; readonly stepId: string }
  | { readonly kind: 'quest-complete'; readonly questId: string; readonly reward: Reward }
  | { readonly kind: 'quest-failed'; readonly questId: string }

export interface Objective {
  readonly questId: string
  readonly questTitle: string
  readonly stepId: string
  readonly text: string
  readonly place?: Place
  readonly npcId?: string
}

interface Progress {
  status: QuestStatus
  open: Set<string>
  done: Set<string>
}

/**
 * Runs quest flows: opens the next steps when one is done, applies what a step
 * changes, and hands out the reward at the end. It is driven entirely by events
 * the game reports, so it can be played through without a renderer.
 */
export class QuestLog {
  #quests: Map<string, QuestDoc>
  #progress: Map<string, Progress>
  #player: PlayerState

  private constructor(quests: readonly QuestDoc[], player: PlayerState, progress: Map<string, Progress>) {
    this.#quests = new Map(quests.map((q) => [q.id, q]))
    this.#player = player
    this.#progress = progress
  }

  static create(quests: readonly QuestDoc[], player: PlayerState): QuestLog {
    const progress = new Map<string, Progress>(
      quests.map((q) => [q.id, { status: 'unstarted' as QuestStatus, open: new Set<string>(), done: new Set<string>() }]),
    )
    return new QuestLog(quests, player, progress)
  }

  /** Resume a playthrough. Quests must be the same validated set the save was made with. */
  static load(value: unknown, quests: readonly QuestDoc[], player: PlayerState): Result<QuestLog, RuntimeError> {
    const parsed = questProgressContract.parse(value)
    if (!parsed.ok) return err({ code: 'invalid-progress', violations: parsed.error })

    const progress = new Map<string, Progress>()
    for (const quest of quests) {
      const saved = parsed.value.quests[quest.id]
      progress.set(quest.id, {
        status: saved?.status ?? 'unstarted',
        open: new Set(saved?.open ?? []),
        done: new Set(saved?.done ?? []),
      })
    }
    return ok(new QuestLog(quests, player, progress))
  }

  quests(): readonly QuestDoc[] {
    return [...this.#quests.values()]
  }

  status(questId: string): QuestStatus | undefined {
    return this.#progress.get(questId)?.status
  }

  /** Quests this NPC can offer right now. */
  offeredBy(npcId: string): readonly QuestDoc[] {
    return this.quests().filter((q) => q.giverNpcId === npcId && this.status(q.id) === 'unstarted')
  }

  start(questId: string): Result<readonly Change[], RuntimeError> {
    const quest = this.#quests.get(questId)
    if (!quest) return err({ code: 'unknown-quest', questId })
    const progress = this.#progress.get(questId)!
    if (progress.status !== 'unstarted') return err({ code: 'already-started', questId })

    progress.status = 'active'
    const changes: Change[] = [{ kind: 'quest-started', questId }]
    this.#open(quest, progress, [quest.startStepId], changes)
    return ok(changes)
  }

  /** Report something the player did. Returns everything that moved because of it. */
  handle(event: unknown): Result<readonly Change[], RuntimeError> {
    const parsed = gameEventContract.parse(event)
    if (!parsed.ok) return err({ code: 'invalid-event', violations: parsed.error })

    const changes: Change[] = []
    for (const quest of this.#quests.values()) {
      const progress = this.#progress.get(quest.id)!
      if (progress.status !== 'active') continue
      for (const stepId of [...progress.open]) {
        const step = quest.steps.find((s) => s.id === stepId)
        if (!step) continue
        if (!this.#matches(step, parsed.value, quest.id)) continue
        if (!this.#allowed(step.requires)) continue
        const chosen = parsed.value.kind === 'chose' ? parsed.value.optionId : undefined
        this.#complete(quest, progress, step, chosen, changes)
      }
    }
    return ok(changes)
  }

  /** What the HUD and the journal show right now. */
  objectives(): readonly Objective[] {
    const out: Objective[] = []
    for (const quest of this.#quests.values()) {
      const progress = this.#progress.get(quest.id)!
      if (progress.status !== 'active') continue
      for (const stepId of progress.open) {
        const step = quest.steps.find((s) => s.id === stepId)
        if (!step) continue
        out.push({
          questId: quest.id,
          questTitle: quest.title,
          stepId: step.id,
          text: step.objective,
          ...('place' in step ? { place: step.place } : {}),
          ...('npcId' in step ? { npcId: step.npcId } : {}),
        })
      }
    }
    return out
  }

  toJSON(): QuestProgressDoc {
    const quests: QuestProgressDoc['quests'] = {}
    for (const [questId, progress] of this.#progress) {
      quests[questId] = { status: progress.status, open: [...progress.open], done: [...progress.done] }
    }
    return { format: 'game-box.quest-progress', schemaVersion: 1, quests }
  }

  #matches(step: Step, event: GameEvent, questId: string): boolean {
    switch (step.kind) {
      case 'talk':
        return event.kind === 'talked' && event.npcId === step.npcId && (!step.topic || step.topic === event.topic)
      case 'goto':
        return event.kind === 'arrived' && samePlace(step.place, event.place)
      case 'collect':
        return event.kind === 'acquired' && event.itemId === step.itemId && (step.allowSteal || !event.stolen)
      case 'deliver':
        return event.kind === 'gave' && event.itemId === step.itemId && event.npcId === step.toNpcId
      case 'stash':
        return (
          event.kind === 'stashed' &&
          event.itemId === step.itemId &&
          event.interiorId === step.interiorId &&
          event.anchorId === step.anchorId
        )
      case 'escort':
        return event.kind === 'arrived' && samePlace(step.place, event.place) && this.#player.isCompanion(step.npcId)
      case 'choice':
        return event.kind === 'chose' && event.questId === questId && event.stepId === step.id
      default:
        return false
    }
  }

  #allowed(conditions: readonly Condition[]): boolean {
    return conditions.every((condition) => {
      switch (condition.kind) {
        case 'has-item':
          return this.#player.has(condition.itemId)
        case 'flag':
          return this.#player.flag(condition.flag) === condition.value
        case 'money-at-least':
          return this.#player.money >= condition.amount
        case 'reputation-at-least':
          return this.#player.reputation(condition.faction) >= condition.amount
        case 'has-companion':
          return this.#player.isCompanion(condition.npcId)
      }
    })
  }

  #complete(quest: QuestDoc, progress: Progress, step: Step, chosenOptionId: string | undefined, changes: Change[]): void {
    progress.open.delete(step.id)
    progress.done.add(step.id)
    changes.push({ kind: 'step-done', questId: quest.id, stepId: step.id })
    this.#apply(step.effects)

    if (step.kind === 'complete') {
      progress.status = 'complete'
      progress.open.clear()
      this.#reward(quest.reward)
      changes.push({ kind: 'quest-complete', questId: quest.id, reward: quest.reward })
      return
    }
    if (step.kind === 'fail') {
      progress.status = 'failed'
      progress.open.clear()
      changes.push({ kind: 'quest-failed', questId: quest.id })
      return
    }

    const next =
      step.kind === 'choice' ? step.options.filter((o) => o.id === chosenOptionId).map((o) => o.next) : step.next
    this.#open(quest, progress, next, changes)
  }

  /** Opens steps, and runs straight through the ones that need no player action. */
  #open(quest: QuestDoc, progress: Progress, stepIds: readonly string[], changes: Change[]): void {
    for (const stepId of stepIds) {
      if (progress.done.has(stepId) || progress.open.has(stepId)) continue
      const step = quest.steps.find((s) => s.id === stepId)
      if (!step) continue

      if (step.kind === 'join' && !step.waitFor.every((id) => progress.done.has(id))) continue

      progress.open.add(step.id)
      changes.push({ kind: 'step-opened', questId: quest.id, stepId: step.id, objective: step.objective })

      if (step.kind === 'join' || step.kind === 'complete' || step.kind === 'fail') {
        this.#complete(quest, progress, step, undefined, changes)
        if (progress.status !== 'active') return
      }
    }

    // a branch finishing may be the last one a join was waiting for
    const waiting = quest.steps.filter(
      (s) => s.kind === 'join' && !progress.done.has(s.id) && !progress.open.has(s.id) && s.waitFor.every((id) => progress.done.has(id)),
    )
    if (waiting.length) this.#open(quest, progress, waiting.map((s) => s.id), changes)
  }

  #apply(effects: readonly Effect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'give-item':
          this.#player.take(effect.itemId)
          break
        case 'take-item':
          this.#player.drop(effect.itemId)
          break
        case 'pay':
          this.#player.earn(effect.amount)
          break
        case 'charge':
          this.#player.spend(effect.amount)
          break
        case 'reputation':
          this.#player.adjustReputation(effect.delta, effect.faction)
          break
        case 'set-flag':
          this.#player.setFlag(effect.flag, effect.value)
          break
        case 'companion-join':
          this.#player.addCompanion(effect.npcId)
          break
        case 'companion-leave':
          this.#player.removeCompanion(effect.npcId)
          break
      }
    }
  }

  #reward(reward: Reward): void {
    this.#player.earn(reward.money)
    if (reward.reputation) this.#player.adjustReputation(reward.reputation, reward.faction)
    for (const itemId of reward.items) this.#player.take(itemId)
  }
}

function samePlace(a: Place, b: Place): boolean {
  if ('plotId' in a && 'plotId' in b) return a.plotId === b.plotId
  if ('interiorId' in a && 'interiorId' in b) return a.interiorId === b.interiorId
  return false
}
