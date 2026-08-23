import { Cast, CLIPS, type CastMember } from '@gb/cast'

/** A set of bodies by NPC id, as `@gb/crowd` and `@gb/cast` both publish it. */
export type Bodies = () => ReadonlyMap<string, CastMember> | undefined

/**
 * Talking with their hands. `@gb/cast` lays a gesture over the upper body on
 * top of whatever the person is already doing, so somebody leaning on their
 * counter keeps leaning on it and moves their arms while they speak. One
 * person gestures at a time, because one person is being talked to.
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

  /** They have started saying something. Their hands go until it stops. */
  start(npcId: string): void {
    if (this.#going === npcId) return
    this.stop()
    const member = this.#member(npcId)
    if (!member) return
    member.gesture(talkFor(member))
    this.#going = npcId
  }

  /** They have finished. Their hands come back to whatever they were doing. */
  stop(): void {
    if (this.#going === undefined) return
    this.#member(this.#going)?.stopGesture()
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

/**
 * The talk that suits the pose they are holding. A gesture is added to the
 * base clip rather than replacing it, so the seated talk is the one to lay
 * over somebody doing what a person at a chair does.
 */
function talkFor(member: CastMember): string {
  return member.playing === Cast.doingAt('sit') ? CLIPS.talkSeated : CLIPS.talk
}
