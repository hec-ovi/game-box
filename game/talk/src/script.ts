import type { QuestDoc } from '@gb/quest'
import { firstAsk } from './job.ts'
import { Listener, type Reading } from './listen.ts'
import type { Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed, sentence } from './text.ts'

const LINES = keyed(PROMPTS.offline)
/** The ways of passing on something you know, so the same fact twice is not the same line twice. */
const HEARSAY = Object.entries(LINES)
  .filter(([key]) => key.startsWith('hearsay-'))
  .map(([, line]) => line)

/**
 * The same conversation with no model behind it. The quest giver's own script is
 * data the game already has, so the job can still be offered, agreed to,
 * carried out and handed back: the person is simply terser than usual. Nothing
 * stored is said as it is stored; a fact or an errand is put inside a sentence
 * somebody would actually speak.
 */
export class Script {
  #situation: Situation
  #listener = new Listener()
  #offered = false
  #fact = 0

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** A line and a move, both from the data. */
  turn(playerText: string, moves: readonly Move[]): { readonly line: string; readonly move: Move | undefined } {
    const reading = this.#listener.read(playerText, moves)
    return { line: this.#line(reading, moves), move: reading.sense === 'move' ? reading.move : undefined }
  }

  /** What they do about what was just said. Nothing, unless it was plainly asked for. */
  decide(playerText: string, moves: readonly Move[]): Move | undefined {
    const reading = this.#listener.read(playerText, moves)
    return reading.sense === 'move' ? reading.move : undefined
  }

  #line(reading: Reading, moves: readonly Move[]): string {
    switch (reading.sense) {
      case 'move':
        return this.#acting(reading.move)
      case 'declined':
        return LINES.declined!
      case 'unclear':
        return LINES.unclear!
      default:
        return this.#idle(moves)
    }
  }

  /** What they say as they do it. */
  #acting(move: Move): string {
    switch (move.action) {
      case 'give_quest': {
        this.#offered = true
        const quest = this.#quest(move.id)
        const ask = quest ? firstAsk(quest) : ''
        return ask ? fill(LINES.taken!, { ask }) : LINES['taken-plain']!
      }
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
    }
  }

  /** Nothing was asked for: put the job on the table, or chase the delivery, or talk. */
  #idle(moves: readonly Move[]): string {
    const offer = moves.find((move) => move.action === 'give_quest')
    const quest = offer && !this.#offered ? this.#quest(offer.id) : undefined
    if (quest) {
      this.#offered = true
      return this.#offer(quest)
    }
    if (moves.some((move) => move.action === 'take_delivery')) return LINES.awaiting!
    return this.#hearsay()
  }

  #offer(quest: QuestDoc): string {
    const pay = quest.reward.money ? fill(LINES.pay!, { money: String(quest.reward.money) }) : LINES['pay-none']!
    const ask = firstAsk(quest)
    return ask
      ? fill(LINES.offer!, { title: quest.title, ask, pay })
      : fill(LINES['offer-plain']!, { title: quest.title, pay })
  }

  /** Something they know, said the way it would be said across a counter. */
  #hearsay(): string {
    const knowledge = this.#situation.world.npc(this.#situation.npcId)?.knowledge ?? []
    if (!knowledge.length || !HEARSAY.length) return LINES.quiet!
    const turn = this.#fact++
    return fill(HEARSAY[turn % HEARSAY.length]!, { fact: sentence(knowledge[turn % knowledge.length]!) })
  }

  #quest(questId: string | undefined): QuestDoc | undefined {
    return this.#situation.log.quests().find((quest) => quest.id === questId)
  }
}
