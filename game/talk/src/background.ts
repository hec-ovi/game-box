import type { Situation } from './moves.ts'

/** One fact this person could let slip now, with the id the codex files it under. */
export interface Offered {
  readonly id: string
  readonly fact: string
}

/**
 * The codex side of a person: the staged facts the world file holds about them,
 * which stages the player has reached, and which facts they have already
 * earned. A fact's id is its position in `npc.background`, counted from 0, so
 * whoever draws the codex finds it with no table between. `met` facts are
 * earned by walking up; `talked` and `quest` facts are earned when the person
 * tells them, and `quest` ones only once one of their jobs is done.
 */
export class Background {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** Seeing them is enough for these: earned on the way in, ids handed back. */
  meet(): readonly string[] {
    return this.#earn(this.#waiting('met').map((offered) => offered.id))
  }

  /** What they may let slip this turn and have not yet, numbered in this order for the prompt. */
  offered(): readonly Offered[] {
    const stages = this.#questDone() ? (['talked', 'quest'] as const) : (['talked'] as const)
    return stages.flatMap((stage) => this.#waiting(stage))
  }

  /** The fact behind a number off the offered list, earned. Nothing for no number or one off the list. */
  reveal(offered: readonly Offered[], number: number | undefined): string | undefined {
    const fact = number === undefined ? undefined : offered[number - 1]
    return fact ? this.#earn([fact.id])[0] : undefined
  }

  #waiting(stage: 'met' | 'talked' | 'quest'): Offered[] {
    const { world, player, npcId } = this.#situation
    const earned = new Set(player.unlocked(npcId))
    const facts = world.npc(npcId)?.background ?? []
    return facts
      .map((fact, index) => ({ id: String(index), fact: fact.fact, stage: fact.unlockedBy }))
      .filter((fact) => fact.stage === stage && !earned.has(fact.id))
  }

  #earn(ids: readonly string[]): readonly string[] {
    for (const id of ids) this.#situation.player.unlock(this.#situation.npcId, id)
    return ids
  }

  /** True once the player has finished a job this person handed out. */
  #questDone(): boolean {
    const { log, npcId } = this.#situation
    const theirs = new Set(log.quests().filter((quest) => quest.giverNpcId === npcId).map((quest) => quest.id))
    return log.journal().some((page) => theirs.has(page.questId) && page.status === 'complete')
  }
}
