import { Hearing } from './hearing.ts'
import type { ActionName, Move } from './moves.ts'

/** How sure the words have to be before an NPC acts on them. */
const ENOUGH = 3

/** Words that asked for something. Heard with no move to match, they get an honest shrug. */
const DEMANDS = ['request', 'offering', 'accept', 'follow', 'stay']

/** Words that asked for a thing a person may not have to give: what they sell, their door. Each is answered in kind. */
const WANTS: ReadonlyArray<{ readonly group: string; readonly action: ActionName; readonly want: Want }> = [
  { group: 'home', action: 'invite_home', want: 'home' },
  { group: 'buying', action: 'show_wares', want: 'wares' },
]

export type Want = 'home' | 'wares'

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

/** What the player's words came to: a move, a want they cannot have, a refusal, a shrug, or just talk. */
export type Reading =
  | { readonly sense: 'move'; readonly move: Move }
  | { readonly sense: 'refused'; readonly want: Want }
  | { readonly sense: 'declined' }
  | { readonly sense: 'unclear' }
  | { readonly sense: 'chat' }

/**
 * Reads plain English against the menu of moves that are legal this turn, with
 * no model in the loop. It weighs every legal move against what was heard and
 * takes the best of them, so the player says what they mean instead of guessing
 * a magic word; when nothing is clear enough, the NPC says so rather than
 * acting on a guess. Same words, same menu, same answer, every time.
 */
export class Listener {
  read(playerText: string, moves: readonly Move[]): Reading {
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
}
