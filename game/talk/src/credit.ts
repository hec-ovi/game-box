import type { Change } from '@gb/quest'
import type { Situation } from './moves.ts'

/** No flow asks the player to hear one person out more times than this in a breath. */
const ROUNDS = 8

/**
 * Crediting the player for having talked to this person. It runs when the
 * conversation opens and again after anything the NPC does, because the step
 * that says "go and hear them out" is usually opened by that same person
 * handing the job over: crediting only on the way in leaves the player stood at
 * the counter being told to go and find whoever is stood in front of them.
 */
export class Greeting {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** Every quest change this talk earns, now. Empty once there is nothing left to credit. */
  credit(): readonly Change[] {
    const { log, npcId } = this.#situation
    const changes: Change[] = []
    for (let round = 0; round < ROUNDS; round++) {
      const handled = log.handle({ kind: 'talked', npcId })
      if (!handled.ok || !handled.value.length) break
      changes.push(...handled.value)
    }
    return changes
  }
}
