import type { CastMember } from '@gb/cast'
import type { Answer } from '@gb/talk'

/** A set of bodies by NPC id, as `@gb/crowd` and `@gb/cast` both publish it. */
export type Bodies = () => ReadonlyMap<string, CastMember> | undefined

/**
 * How a reply reads on the body. Both are in `@gb/cast`'s `GESTURES`, so they
 * lay over whatever stance the person is already holding.
 */
const ANSWERS: Record<Answer, string> = { yes: 'Idle_Yes_Loop', no: 'Idle_No_Loop' }

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
 * Somebody speaking. `@gb/cast` mimics a line rather than lip syncing one: the
 * talk that suits the stance they hold goes over their upper body for as long
 * as the line is open, and their head beats to the chunks of it arriving, so
 * somebody leaning on their counter keeps leaning on it while they talk. One
 * person speaks at a time, because one person is being talked to.
 */
export class Gestures {
  #where: readonly Bodies[]
  #going: string | undefined

  /**
   * Where bodies come from, asked in order: the pavement first, because
   * somebody out walking is not also standing behind their own counter. Both
   * boxes answer the same question in the same shape, so there is one lookup.
   */
  constructor(...where: Bodies[]) {
    this.#where = where
  }

  /** They have started saying something. The line is open until it stops. */
  start(npcId: string): void {
    if (this.#going === npcId) return
    this.stop()
    const member = this.#member(npcId)
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
    this.#member(npcId)?.pulse()
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
   * They answered: a nod for a yes, a slow shake of the head for a no. It goes
   * over the talking hands, because it is the last thing they do with the turn.
   */
  answer(npcId: string, answer: Answer): void {
    const member = this.#member(npcId)
    if (!member) return
    member.gesture(ANSWERS[answer])
    this.#going = npcId
  }

  /** They have finished. The line closes and their hands come back to whatever they were doing. */
  stop(): void {
    if (this.#going === undefined) return
    const member = this.#member(this.#going)
    member?.speak(false)
    member?.stopGesture()
    this.#going = undefined
  }

  /**
   * The body this person is wearing this frame. Asked again every time and
   * never kept: `@gb/crowd` recycles a retired walker's body onto the next
   * person out, so a member held from one turn to the next is a stranger's arms.
   */
  #member(npcId: string): CastMember | undefined {
    for (const bodies of this.#where) {
      const found = bodies()?.get(npcId)
      if (found) return found
    }
    return undefined
  }
}
