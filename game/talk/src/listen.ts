import type { Decision } from './events.ts'
import { Hearing } from './hearing.ts'
import { Home } from './home.ts'
import type { ActionName, Move, Situation } from './moves.ts'

/** How sure the words have to be before an NPC acts on them. */
const ENOUGH = 3

/** Words that asked for something. Heard with no move to match, nothing on the menu answers them. */
const DEMANDS = ['request', 'offering', 'accept', 'follow', 'stay']

/** Words that asked for a thing a person may not have to give: what they sell, their door. Each is answered in kind. */
const WANTS: ReadonlyArray<{ readonly group: string; readonly action: ActionName; readonly want: Want }> = [
  { group: 'home', action: 'invite_home', want: 'home' },
  { group: 'buying', action: 'show_wares', want: 'wares' },
]

type Want = 'home' | 'wares'

/**
 * How much each move is worth given what was heard. Every rule reads the moves
 * that are legal this turn, so nothing here can pick something the NPC is not
 * allowed to do; the worst it can do is pick nothing.
 */
const WEIGH: Record<ActionName, (heard: Hearing, move: Move) => number> = {
  give_quest: (heard, move) => {
    if (heard.has('refuse')) return 0
    if (heard.has('accept')) return 5
    if (!heard.has('request')) return 0
    if (heard.has('work')) return 5
    if (heard.names(move.subject)) return 4
    return heard.has('pointing') ? 3 : 0
  },
  ask_about: (heard, move) => {
    if (heard.has('refuse') || !heard.names(move.subject)) return 0
    return heard.hasAny(['asking', 'request']) ? 4 : 0
  },
  take_delivery: (heard, move) => {
    if (heard.has('refuse')) return 0
    if (heard.has('offering')) return 5
    return heard.names(move.subject) && !heard.has('request') ? 3 : 0
  },
  hand_over: (heard, move) => {
    if (heard.has('refuse') || !heard.has('request')) return 0
    if (heard.names(move.subject)) return 5
    return heard.has('pointing') && !heard.has('work') ? 4 : 0
  },
  show_wares: (heard, move) => {
    if (heard.has('refuse')) return 0
    if (heard.has('buying')) return 5
    return heard.has('request') && heard.names(move.subject) ? 4 : 0
  },
  follow_player: (heard) => (heard.has('refuse') ? 0 : heard.has('follow') ? 5 : 0),
  stop_following: (heard) => (heard.has('stay') ? 5 : 0),
  invite_home: (heard) => (heard.has('refuse') ? 0 : heard.has('home') ? 5 : 0),
  end_talk: (heard) => (heard.has('farewell') ? 5 : 0),
}

/** What the player's words came to: a move, a want they cannot have, a refusal, a demand with no move behind it, or just talk. */
type Reading =
  | { readonly sense: 'move'; readonly move: Move }
  | { readonly sense: 'refused'; readonly want: Want }
  | { readonly sense: 'declined' }
  | { readonly sense: 'unclear' }
  | { readonly sense: 'chat' }

/**
 * The action side of a turn when no model decided it: nothing running, a call
 * that never came back, or one that answered with no line off the menu. It
 * reads plain English against the moves that are legal this turn, weighs every
 * one of them against what was heard and takes the best, so the player says
 * what they mean instead of guessing a magic word; when nothing is clear
 * enough, nothing is done rather than something the player did not ask for.
 * It writes no words: what an NPC says is the model's, and only the model's.
 */
export class Listener {
  #home: Home

  constructor(situation: Situation) {
    this.#home = new Home(situation)
  }

  /** How the turn comes out on the player's words alone: the move, and how the reply reads. */
  decide(playerText: string, moves: readonly Move[]): Decision {
    return this.#settle(this.#read(playerText, moves))
  }

  #read(playerText: string, moves: readonly Move[]): Reading {
    const heard = Hearing.of(playerText)
    let best: Move | undefined
    let score = 0
    for (const move of moves) {
      const weight = WEIGH[move.action](heard, move)
      if (weight > score) {
        best = move
        score = weight
      }
    }
    if (best && score >= ENOUGH) return { sense: 'move', move: best }
    const refused = WANTS.find((want) => heard.has(want.group) && !moves.some((move) => move.action === want.action))
    if (refused) return { sense: 'refused', want: refused.want }
    if (heard.has('refuse')) return { sense: 'declined' }
    return heard.hasAny(DEMANDS) ? { sense: 'unclear' } : { sense: 'chat' }
  }

  /**
   * How the turn came out, in the character's terms rather than the player's.
   * What they were plainly asked for they do, and doing it is the yes. Asked
   * outright for something they have no way to give, the answer is no: the
   * request was made and nothing they can do answers it. A door already open to
   * the player is not refused, only already theirs, so that is neither.
   * Everything else, a refusal the player made included, leaves them neither
   * way: they are hearing the other person out, and nothing about that reads as
   * an answer.
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
}
