import type { Answer } from '@gb/talk'
import type { Members } from './members.ts'

/**
 * How a reply reads on the body. Both are in `@gb/cast`'s `GESTURES`, so they
 * lay over whatever stance the person is already holding.
 */
const ANSWERS: Record<Answer, string> = { yes: 'Idle_Yes_Loop', no: 'Idle_No_Loop' }

/**
 * How long a nod or a shake of the head stands on its own, in seconds.
 *
 * A spoken turn closes it: the line ends, the hands come down and the answer
 * comes down with them. A turn nobody spoke on has no line to end, and the
 * whole of it arrives inside one tick, so an answer closed with the turn was
 * faded in and out on the same frame and the player saw nothing move. Long
 * enough to read as a nod, short enough that a loop does not settle in as a tic.
 */
const BEAT = 1.5

/**
 * What a stage direction may mean on the body, read for its words. The model
 * writes prose and never names a clip: a direction that says they nod is the
 * nod, one that says they shake their head is the shake, and anything else is
 * words the panel prints and the hands already talking.
 */
const DIRECTIONS: readonly { means: Answer; said: RegExp }[] = [
  { means: 'no', said: /\bshak(?:es|ing|e)\b[^.]{0,20}\bhead\b|\bhead ?shake\b/i },
  { means: 'yes', said: /\bnod(?:s|ded|ding)?\b/i },
]

/**
 * Somebody speaking, and somebody answering without speaking. `@gb/cast` mimics
 * a line rather than lip syncing one: the talk that suits the stance they hold
 * goes over their upper body for as long as the line is open, and their head
 * beats to the chunks of it arriving, so somebody leaning on their counter
 * keeps leaning on it while they talk. One person moves at a time, because one
 * person is being talked to.
 *
 * The talk is only ever laid over words actually arriving. A turn no model
 * answered has none, and hands miming a line the player never gets would be a
 * body saying what nobody wrote. What such a turn does have is the answer it
 * came down as, which `@gb/talk` publishes whenever the person carried
 * something out, and that is a real movement of the head: it is played here on
 * its own and held for its own beat.
 */
export class Gestures {
  #members: Members
  #going: string | undefined
  /** A nod or a shake standing with no line under it, and what is left of its beat. */
  #held: { npcId: string; left: number } | undefined

  /** Whoever is drawing a body for somebody, wherever they are standing. */
  constructor(members: Members) {
    this.#members = members
  }

  /** They have started saying something. The line is open until it stops. */
  start(npcId: string): void {
    if (this.#going === npcId) return
    this.release()
    const member = this.#members.of(npcId)
    if (!member) return
    member.speak(true)
    this.#going = npcId
  }

  /**
   * A piece of the line arriving. The beat picks up on each one and decays in
   * between, so a stream that stalls goes still while the hands keep going.
   */
  pulse(npcId: string): void {
    if (this.#going !== npcId) return
    this.#members.of(npcId)?.pulse()
  }

  /**
   * What they do, as the turn describes it. Read for a nod or a shake of the
   * head and played as that; a direction that reads as neither plays nothing,
   * because the words are the panel's and the hands are already going.
   */
  direct(npcId: string, does: string): void {
    const meant = DIRECTIONS.find((direction) => direction.said.test(does))?.means
    if (meant) this.answer(npcId, meant)
  }

  /**
   * They answered: a nod for a yes, a slow shake of the head for a no. On a
   * turn with words it goes over the talking hands, because it is the last
   * thing they do with the turn. On a turn with none it is the only thing they
   * do, so it is held for a beat and closed by the frame rather than by the end
   * of a turn that is already over.
   */
  answer(npcId: string, answer: Answer): void {
    const member = this.#members.of(npcId)
    if (!member) return
    member.gesture(ANSWERS[answer])
    if (this.#going !== npcId) this.#held = { npcId, left: BEAT }
  }

  /**
   * One frame. The only thing with a clock of its own is an answer standing on
   * a wordless turn: it is counted down here and closed when its beat is up.
   */
  update(seconds: number): void {
    const held = this.#held
    if (!held) return
    const left = held.left - seconds
    if (left > 0) {
      this.#held = { npcId: held.npcId, left }
      return
    }
    this.#held = undefined
    this.#members.of(held.npcId)?.stopGesture()
  }

  /**
   * The line has ended. Their hands come back to whatever they were doing; an
   * answer standing on its own is left to its beat, because no line ended it.
   */
  stop(): void {
    if (this.#going === undefined) return
    const member = this.#members.of(this.#going)
    member?.speak(false)
    member?.stopGesture()
    this.#going = undefined
  }

  /** The conversation is over: whatever was open and whatever was standing comes off. */
  release(): void {
    this.stop()
    const held = this.#held
    this.#held = undefined
    if (held) this.#members.of(held.npcId)?.stopGesture()
  }
}
