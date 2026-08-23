/**
 * What a player can do in the running game.
 *
 * A quest step is finished by an event, and an event only happens because
 * somebody did something. This is the list of somethings, and it is the only
 * thing the harness is allowed to know about the boxes that produce them:
 * @gb/forge cannot call into them, so it writes down what they have shipped and
 * credits a step through a verb on this list or credits nothing at all.
 *
 * `ABSENT` is what nobody can do yet. It is empty: every verb a generated quest
 * asks for has a producer in the running game. When a step kind is written that
 * nothing can finish, it goes here with the box that owes it, and the figure in
 * `playable.ts` drops until that box ships.
 */

/** One thing a player does, in the words the game would use for it. */
export type Verb = 'talk' | 'talk about' | 'walk' | 'take' | 'hand over' | 'put down' | 'answer'

/** Every verb the harness knows how to do, and what the game reports when it is done. */
export const VERBS: Readonly<Record<Verb, string>> = {
  talk: 'talked',
  'talk about': 'talked, with the subject the player put them to',
  walk: 'arrived',
  take: 'acquired',
  'hand over': 'gave',
  'put down': 'stashed',
  answer: 'chose',
}

/** A verb the game does not have yet, and who is building it. */
export interface Absent {
  readonly verb: Verb
  /** The box that owes it. */
  readonly owner: string
  /** What is missing, in one line. */
  readonly why: string
}

/** Nothing: every verb above has a producer. */
const ABSENT: readonly Absent[] = []

/** What a player can do. The default set is what the running game gives them. */
export class Hands {
  #absent: readonly Absent[]

  constructor(absent: readonly Absent[] = ABSENT) {
    this.#absent = absent
  }

  can(verb: Verb): boolean {
    return !this.#absent.some((one) => one.verb === verb)
  }

  /** What is standing in the way of this verb, for a report to quote. */
  missing(verb: Verb): Absent | undefined {
    return this.#absent.find((one) => one.verb === verb)
  }
}

/** The hands the running game gives a player today. */
export const HANDS = new Hands()
