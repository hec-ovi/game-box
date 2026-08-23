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
 *
 * A step that names a subject is a different promise: it is credited only when
 * the NPC is put to that subject, so the topic rides on the event and nothing
 * else about the conversation completes it.
 */
export class Credit {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /**
   * Every quest change this talk earns, now. Empty once there is nothing left
   * to credit. `topic` is the subject the NPC was just put to, and it credits
   * the steps waiting on that subject as well as the ones waiting on nothing.
   */
  earned(topic?: string): readonly Change[] {
    const { log, npcId } = this.#situation
    const changes: Change[] = []
    for (let round = 0; round < ROUNDS; round++) {
      const handled = log.handle(topic ? { kind: 'talked', npcId, topic } : { kind: 'talked', npcId })
      if (!handled.ok || !handled.value.length) break
      changes.push(...handled.value)
    }
    return changes
  }
}
