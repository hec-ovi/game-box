import type { QuestDoc } from '@gb/quest'
import type { ActionName, Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

const LINES = keyed(PROMPTS.offline)

/** What the player's words have to contain for this NPC to act on them. */
const INTENTS: ReadonlyArray<{ readonly action: ActionName; readonly words: readonly string[] }> = [
  { action: 'end_talk', words: ['bye', 'goodbye', 'see you', 'later', 'never mind', 'forget it'] },
  { action: 'take_delivery', words: ['here', 'brought', 'got it', 'take it', 'take this', 'yours', 'for you', 'delivered'] },
  { action: 'give_quest', words: ['yes', 'yeah', 'yep', 'aye', 'sure', 'ok', 'okay', 'fine', 'deal', "i'll do it", 'i will', "i'm in", 'go on'] },
  { action: 'hand_over', words: ['give me', 'hand it', 'can i have', 'let me have', 'i need'] },
  { action: 'follow_player', words: ['follow', 'come with', 'with me', 'lead on'] },
  { action: 'stop_following', words: ['stay here', 'wait here', 'stop following', 'stay put'] },
]

/**
 * The same conversation with no model behind it. The quest giver's own script is
 * data the game already has, so the job can still be offered, agreed to,
 * carried out and handed back: the person is simply terser than usual.
 */
export class Script {
  #situation: Situation
  #offered = false
  #fact = 0

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** A line and a move, both from the data. */
  turn(playerText: string, moves: readonly Move[]): { readonly line: string; readonly move: Move | undefined } {
    const move = this.decide(playerText, moves)
    return { line: this.#line(move, moves), move }
  }

  /** What they do about what was just said. Nothing, unless it was plainly asked for. */
  decide(playerText: string, moves: readonly Move[]): Move | undefined {
    const said = ` ${playerText.toLowerCase().replace(/[^a-z' ]+/g, ' ')} `
    for (const intent of INTENTS) {
      const move = moves.find((candidate) => candidate.action === intent.action)
      if (!move) continue
      if (intent.words.some((word) => said.includes(` ${word} `))) return move
    }
    return undefined
  }

  #line(move: Move | undefined, moves: readonly Move[]): string {
    switch (move?.action) {
      case 'give_quest':
        this.#offered = true
        return fill(LINES.taken!, { objective: this.#firstObjective(move.id) })
      case 'take_delivery':
        return LINES.delivered!
      case 'hand_over':
        return LINES.handed!
      case 'follow_player':
        return LINES.following!
      case 'stop_following':
        return LINES.stopped!
      case 'end_talk':
        return LINES.farewell!
      default:
        return this.#idleLine(moves)
    }
  }

  /** Nothing was asked for: put the job on the table, or chase the delivery, or talk. */
  #idleLine(moves: readonly Move[]): string {
    const offer = moves.find((move) => move.action === 'give_quest')
    if (offer && !this.#offered) {
      this.#offered = true
      const quest = this.#quest(offer.id)
      return fill(LINES.offer!, { title: quest?.title ?? 'a job', objective: this.#firstObjective(offer.id) })
    }
    if (moves.some((move) => move.action === 'take_delivery')) return LINES.awaiting!

    const knowledge = this.#situation.world.npc(this.#situation.npcId)?.knowledge ?? []
    if (!knowledge.length) return LINES.quiet!
    return knowledge[this.#fact++ % knowledge.length]!
  }

  /** The first thing the job asks for, punctuated so it can sit in a spoken line. */
  #firstObjective(questId: string | undefined): string {
    const quest = this.#quest(questId)
    const step = quest?.steps.find((candidate) => candidate.id === quest.startStepId)
    const objective = step?.objective ?? ''
    return !objective || /[.!?]$/.test(objective) ? objective : `${objective}.`
  }

  #quest(questId: string | undefined): QuestDoc | undefined {
    return this.#situation.log.quests().find((quest) => quest.id === questId)
  }
}
