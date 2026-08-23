import type { QuestDoc } from '@gb/quest'
import type { Decision } from './events.ts'
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
  #told = 0

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** A line and how the turn came out, both from the data. */
  turn(playerText: string, moves: readonly Move[]): Decision & { readonly line: string } {
    const reading = this.#listener.read(playerText, moves)
    return { ...settle(reading), line: this.#line(reading, moves) }
  }

  /** What they do about what was just said. Nothing, unless it was plainly asked for. */
  decide(playerText: string, moves: readonly Move[]): Decision {
    return settle(this.#listener.read(playerText, moves))
  }

  /** What they say as they do it, straight from the data. */
  acting(move: Move): string {
    switch (move.action) {
      case 'give_quest': {
        this.#offered = true
        const quest = this.#quest(move.id)
        const ask = quest ? firstAsk(quest) : ''
        return ask ? fill(LINES.taken!, { ask }) : LINES['taken-plain']!
      }
      case 'ask_about': {
        const topic = move.subject ?? ''
        const fact = this.#fact()
        return fact ? fill(LINES.told!, { topic, fact }) : fill(LINES['told-quiet']!, { topic })
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

  #line(reading: Reading, moves: readonly Move[]): string {
    switch (reading.sense) {
      case 'move':
        return this.acting(reading.move)
      case 'declined':
        return LINES.declined!
      case 'unclear':
        return LINES.unclear!
      default:
        return this.#idle(moves)
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
    const turn = this.#told
    const fact = this.#fact()
    if (!fact || !HEARSAY.length) return LINES.quiet!
    return fill(HEARSAY[turn % HEARSAY.length]!, { fact })
  }

  /** The next thing they know, punctuated to sit in a line. Empty when they know nothing. */
  #fact(): string {
    const knowledge = this.#situation.world.npc(this.#situation.npcId)?.knowledge ?? []
    if (!knowledge.length) return ''
    const turn = this.#told++
    return sentence(knowledge[turn % knowledge.length]!)
  }

  #quest(questId: string | undefined): QuestDoc | undefined {
    return this.#situation.log.quests().find((quest) => quest.id === questId)
  }
}

/**
 * How the turn came out, in the character's terms rather than the player's. What
 * they were plainly asked for they do, and doing it is the yes. Asked for
 * something they cannot give, they say so, and that is the no. Everything else,
 * a refusal the player made included, leaves them neither way: they are hearing
 * the other person out, and nothing about that reads as an answer.
 */
function settle(reading: Reading): Decision {
  if (reading.sense === 'move') return { move: reading.move }
  return reading.sense === 'unclear' ? { answer: 'no' } : {}
}
