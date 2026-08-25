import type { Change, QuestDoc, Step } from '@gb/quest'
import type { Grant } from './events.ts'
import { Locks } from './locks.ts'
import type { Situation } from './moves.ts'

/** A payoff a step of theirs hands over: the grant, and the subject that has to be raised first, when one has. */
export interface Payoff {
  readonly grant: Grant
  readonly topic?: string | undefined
}

/**
 * Access as a quest's payoff: the password a step gives out, the key or card
 * it puts in the player's hand, the door a reward opens. The quest log lands
 * them; this reads which ones this person's own steps carry, so the person
 * can say the word out loud, and which ones a set of changes just landed, so
 * the box can publish them.
 */
export class Payoffs {
  #situation: Situation
  #locks: Locks

  constructor(situation: Situation) {
    this.#situation = situation
    this.#locks = new Locks(situation.world)
  }

  /** What this person is still to hand over: the open talk steps of theirs that carry a payoff. */
  waiting(): readonly Payoff[] {
    const { log, npcId } = this.#situation
    const payoffs: Payoff[] = []
    for (const objective of log.objectives()) {
      const step = this.#step(objective.questId, objective.stepId)
      if (step?.kind !== 'talk' || step.npcId !== npcId) continue
      for (const grant of this.#grantsOf(step)) payoffs.push({ grant, topic: step.topic })
    }
    return payoffs
  }

  /** What this person has already handed over: the done talk steps of theirs that carried one. */
  given(): readonly Grant[] {
    const { log, npcId } = this.#situation
    const grants: Grant[] = []
    for (const page of log.journal()) {
      for (const line of page.steps) {
        if (line.state !== 'done') continue
        const step = this.#step(page.questId, line.stepId)
        if (step?.kind === 'talk' && step.npcId === npcId) grants.push(...this.#grantsOf(step))
      }
    }
    return grants
  }

  /** What these changes handed the player: the payoffs of every step done and every reward paid. */
  landed(changes: readonly Change[]): readonly Grant[] {
    const grants: Grant[] = []
    for (const change of changes) {
      if (change.kind === 'step-done') {
        const step = this.#step(change.questId, change.stepId)
        if (step) grants.push(...this.#grantsOf(step))
      }
      if (change.kind === 'quest-complete') {
        for (const itemId of change.reward.items) grants.push(...this.#key(itemId))
        for (const access of change.reward.access ?? []) grants.push({ kind: 'granted', access })
      }
    }
    return grants
  }

  #grantsOf(step: Step): Grant[] {
    const grants: Grant[] = []
    for (const effect of step.effects) {
      if (effect.kind === 'give-password') grants.push({ kind: 'granted', password: effect.password })
      if (effect.kind === 'give-item') grants.push(...this.#key(effect.itemId))
    }
    return grants
  }

  /** A thing handed over is a grant only when the city says it opens something. */
  #key(itemId: string): Grant[] {
    return this.#locks.opensWith(itemId) ? [{ kind: 'granted', keyItemId: itemId }] : []
  }

  #step(questId: string, stepId: string): Step | undefined {
    const quest: QuestDoc | undefined = this.#situation.log.quests().find((candidate) => candidate.id === questId)
    return quest?.steps.find((step) => step.id === stepId)
  }
}
