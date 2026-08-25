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
export type Verb = 'talk' | 'talk about' | 'walk' | 'walk with' | 'take' | 'hand over' | 'put down' | 'answer'

/** Every verb the harness knows how to do, and what the game reports when it is done. */
export const VERBS: Readonly<Record<Verb, string>> = {
  talk: 'talked',
  'talk about': 'talked, with the subject the player put them to',
  walk: 'arrived',
  'walk with': 'companion-arrived, the companion having got there on foot beside the player',
  take: 'acquired',
  'hand over': 'gave',
  'put down': 'stashed',
  answer: 'chose',
}

/**
 * What each verb costs on the game clock, in game seconds, which is what a
 * timed job is measured against. `@gb/quest` budgets 600 for a conversation
 * (one model reply is 200 to 450) and 3000 for a walk across town, so a verb
 * that walks somewhere costs a walk and one that talks costs a reply; handing
 * something over is both. A job whose timer cannot cover its own verbs at
 * these prices fails in the harness the way it would fail a real player.
 */
export const COSTS: Readonly<Record<Verb, number>> = {
  talk: 600,
  'talk about': 600,
  walk: 3000,
  'walk with': 3000,
  take: 3000,
  'hand over': 3600,
  'put down': 3000,
  answer: 600,
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
