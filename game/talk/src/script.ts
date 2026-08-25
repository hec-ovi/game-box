import type { QuestDoc } from '@gb/quest'
import type { Background } from './background.ts'
import type { Decision, Grant } from './events.ts'
import { Home } from './home.ts'
import { firstAsk } from './job.ts'
import { Listener, type Reading, type Want } from './listen.ts'
import type { Move, Situation } from './moves.ts'
import { Payoffs } from './payoffs.ts'
import { PROMPTS } from './prompts.generated.ts'
import { Stock } from './stock.ts'
import { fill, keyed, sentence } from './text.ts'

const LINES = keyed(PROMPTS.offline)
/** The ways of passing on something you know, so the same fact twice is not the same line twice. */
const HEARSAY = Object.entries(LINES)
  .filter(([key]) => key.startsWith('hearsay-'))
  .map(([, line]) => line)

/** A scripted line, and the background fact it gave away when it gave one. */
export interface Spoken {
  readonly line: string
  readonly learned?: string | undefined
}

/**
 * The same conversation with no model behind it. The quest giver's own script is
 * data the game already has, so the job can still be offered, agreed to,
 * carried out and handed back: the person is simply terser than usual. Nothing
 * stored is said as it is stored; a fact or an errand is put inside a sentence
 * somebody would actually speak, and a fact about themselves is earned the
 * moment it is said.
 */
export class Script {
  #situation: Situation
  #background: Background
  #home: Home
  #stock: Stock
  #payoffs: Payoffs
  #listener = new Listener()
  #offered = false
  #told = 0

  constructor(situation: Situation, background: Background) {
    this.#situation = situation
    this.#background = background
    this.#home = new Home(situation)
    this.#stock = new Stock(situation)
    this.#payoffs = new Payoffs(situation)
  }

  /** A line and how the turn came out, both from the data. */
  turn(playerText: string, moves: readonly Move[]): Decision & Spoken {
    const reading = this.#listener.read(playerText, moves)
    return { ...this.#settle(reading), ...this.#line(reading, moves) }
  }

  /** What they do about what was just said. Nothing, unless it was plainly asked for. */
  decide(playerText: string, moves: readonly Move[]): Decision {
    return this.#settle(this.#listener.read(playerText, moves))
  }

  /** What they say as they do it, straight from the data. */
  acting(move: Move): Spoken {
    switch (move.action) {
      case 'give_quest': {
        this.#offered = true
        const quest = this.#quest(move.id)
        const ask = quest ? firstAsk(quest) : ''
        return { line: ask ? fill(LINES.taken!, { ask }) : LINES['taken-plain']! }
      }
      case 'ask_about': {
        const topic = move.subject ?? ''
        const fact = this.#fact()
        const told = fact
          ? { line: fill(LINES.told!, { topic, fact: fact.text }), learned: fact.learned }
          : { line: fill(LINES['told-quiet']!, { topic }) }
        // The subject raised is what pays out: the word or the key is said as it changes hands.
        const payoff = this.#payoffs.waiting().filter((candidate) => candidate.topic === move.id).map((candidate) => this.#handing(candidate.grant))
        return { ...told, line: [told.line, ...payoff].join(' ') }
      }
      case 'take_delivery':
        return { line: LINES.delivered! }
      case 'hand_over':
        return { line: LINES.handed! }
      case 'show_wares': {
        const list = this.#stock.wares().map((ware) => fill(LINES.ware!, { name: ware.name, price: String(ware.price) }))
        return { line: fill(LINES.wares!, { list: list.join('; ') }) }
      }
      case 'invite_home':
        return { line: LINES.invited! }
      case 'follow_player':
        return { line: LINES.following! }
      case 'stop_following':
        return { line: LINES.stopped! }
      case 'end_talk':
        return { line: LINES.farewell! }
    }
  }

  #line(reading: Reading, moves: readonly Move[]): Spoken {
    switch (reading.sense) {
      case 'move':
        return this.acting(reading.move)
      case 'refused':
        return { line: this.#refusal(reading.want) }
      case 'declined':
        return { line: LINES.declined! }
      case 'unclear':
        return { line: LINES.unclear! }
      default:
        return this.#idle(moves)
    }
  }

  /** Nothing was asked for: put the job on the table, or chase the delivery, or talk. */
  #idle(moves: readonly Move[]): Spoken {
    const offer = moves.find((move) => move.action === 'give_quest')
    const quest = offer && !this.#offered ? this.#quest(offer.id) : undefined
    if (quest) {
      this.#offered = true
      return { line: this.#offer(quest) }
    }
    if (moves.some((move) => move.action === 'take_delivery')) return { line: LINES.awaiting! }
    return this.#hearsay()
  }

  /** Asked for what they have not got to give: no wares, or a door they keep shut to this player. */
  #refusal(want: Want): string {
    if (want === 'wares') return LINES['wares-none']!
    return this.#home.open() ? LINES['home-open']! : LINES['refused-home']!
  }

  /** The payoff as it is said: the word, or the thing. */
  #handing(grant: Grant): string {
    if ('password' in grant) return fill(LINES['told-password']!, { password: grant.password })
    const item = 'keyItemId' in grant ? this.#situation.world.item(grant.keyItemId)?.name.toLowerCase() : undefined
    return item ? fill(LINES['told-key']!, { item }) : ''
  }

  /**
   * How the turn came out, in the character's terms rather than the player's. What
   * they were plainly asked for they do, and doing it is the yes. Asked for
   * something they cannot give, they say so, and that is the no; a door already
   * open to the player is not refused, only pointed at. Everything else, a refusal
   * the player made included, leaves them neither way: they are hearing the other
   * person out, and nothing about that reads as an answer.
   */
  #settle(reading: Reading): Decision {
    switch (reading.sense) {
      case 'move':
        return { move: reading.move }
      case 'unclear':
        return { answer: 'no' }
      case 'refused':
        return reading.want === 'home' && this.#home.open() ? {} : { answer: 'no' }
      default:
        return {}
    }
  }

  #offer(quest: QuestDoc): string {
    const pay = quest.reward.money ? fill(LINES.pay!, { money: String(quest.reward.money) }) : LINES['pay-none']!
    const ask = firstAsk(quest)
    return ask
      ? fill(LINES.offer!, { title: quest.title, ask, pay })
      : fill(LINES['offer-plain']!, { title: quest.title, pay })
  }

  /** Something they know, said the way it would be said across a counter. */
  #hearsay(): Spoken {
    const turn = this.#told
    const fact = this.#fact()
    if (!fact || !HEARSAY.length) return { line: LINES.quiet! }
    return { line: fill(HEARSAY[turn % HEARSAY.length]!, { fact: fact.text }), learned: fact.learned }
  }

  /**
   * The next thing they have to say, punctuated to sit in a line: what they
   * know of the town first, then what they could let slip about themselves.
   * Nothing when they have nothing.
   */
  #fact(): { text: string; learned?: string | undefined } | undefined {
    const knowledge = this.#situation.world.npc(this.#situation.npcId)?.knowledge ?? []
    const offered = this.#background.offered()
    const total = knowledge.length + offered.length
    if (!total) return undefined
    const turn = this.#told++ % total
    if (turn < knowledge.length) return { text: sentence(knowledge[turn]!) }
    const number = turn - knowledge.length + 1
    return { text: sentence(offered[number - 1]!.fact), learned: this.#background.reveal(offered, number) }
  }

  #quest(questId: string | undefined): QuestDoc | undefined {
    return this.#situation.log.quests().find((quest) => quest.id === questId)
  }
}

