import { Cast, CLIPS, type CastMember } from '@gb/cast'

/**
 * Talking with their hands. `@gb/cast` lays a gesture over the upper body on
 * top of whatever the person is already doing, so somebody leaning on their
 * counter keeps leaning on it and moves their arms while they speak. One
 * person gestures at a time, because one person is being talked to.
 */
export class Gestures {
  #member: (npcId: string) => CastMember | undefined
  #going: string | undefined

  constructor(member: (npcId: string) => CastMember | undefined) {
    this.#member = member
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
}

/**
 * The talk that suits the pose they are holding. A gesture is added to the
 * base clip rather than replacing it, so the seated talk is the one to lay
 * over somebody doing what a person at a chair does.
 */
function talkFor(member: CastMember): string {
  return member.playing === Cast.doingAt('sit') ? CLIPS.talkSeated : CLIPS.talk
}
