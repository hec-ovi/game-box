import type { Attention } from '@gb/crowd'
import * as THREE from 'three'

/** Somebody the art pack can turn to look at whoever is speaking. */
export interface Facing {
  lookAt(point: THREE.Vector3): void
  lookAway(): void
}

/** Somebody standing at their own post: a body that can turn and, with the art pack, a head that can look. */
export interface Post {
  readonly body: THREE.Object3D
  readonly head?: Facing
}

/** Whoever can hold a person on the street still. `Street` is the one. */
export interface Holder {
  attend(npcId: string, x: number, y: number, z: number): Attention | undefined
}

/** How far a head turns off its own shoulders before the body has to come round with it, in radians. */
const HEAD_TURN = 1.25

/** How fast a body swings round, per radian it still has to turn, per second. */
const TURN_EASE = 8

/** However far there is to go, a body never turns faster than this, in radians per second. */
const TURN_QUICKEST = 4

/** Close enough to the way they were standing to call it done, in radians. */
const HOME = 0.01

const TWO_PI = Math.PI * 2

/** The shortest way round from one angle to another, in (-PI, PI]. */
function angleDelta(from: number, to: number): number {
  let d = (to - from) % TWO_PI
  if (d > Math.PI) d -= TWO_PI
  if (d <= -Math.PI) d += TWO_PI
  return d
}

/** Swing towards an angle the way a body turns: quickly while there is a way to go, softly as it arrives. */
function easeToward(current: number, target: number, seconds: number): number {
  const delta = angleDelta(current, target)
  const room = Math.abs(delta)
  return current + Math.sign(delta) * Math.min(room, Math.min(room * TURN_EASE, TURN_QUICKEST) * seconds)
}

/** The yaw a body needs for its own front, its -Z, to point along a direction on the ground. */
function headingOf(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

/**
 * Somebody who works at a spot: a shopkeeper behind their counter, a guard on
 * their door. They are already standing still, so being talked to turns them
 * rather than stopping them, and only as far as they need: the head does the
 * first three quarters of a right angle and the body brings the rest, so
 * nobody swings their back to the counter they are working at. Let go, they
 * come round to the way the room put them.
 */
export class Anchored {
  #body: THREE.Object3D
  #head: Facing | undefined
  #home: number
  #aim = new THREE.Vector3()
  #leaving = false

  constructor(post: Post) {
    this.#body = post.body
    this.#head = post.head
    this.#home = post.body.rotation.y
  }

  /** True once they are back the way they were standing and there is nothing left to do. */
  get settled(): boolean {
    return this.#leaving && Math.abs(angleDelta(this.#body.rotation.y, this.#home)) < HOME
  }

  /** One frame of paying attention to a point, or of coming back off it. */
  update(seconds: number, at: THREE.Vector3): void {
    this.#body.rotation.y = easeToward(this.#body.rotation.y, this.#leaving ? this.#home : this.#turn(at), seconds)
    if (!this.#leaving) this.#head?.lookAt(this.#look(at))
  }

  /** The conversation is over: look away and start coming round. */
  letGo(): void {
    if (this.#leaving) return
    this.#leaving = true
    this.#head?.lookAway()
  }

  /** Back on their post this instant, for when somebody else is spoken to before they got there. */
  home(): void {
    this.letGo()
    this.#body.rotation.y = this.#home
  }

  /** How far round they have to come: as little as leaves the point inside a head turn. */
  #turn(at: THREE.Vector3): number {
    const off = angleDelta(this.#home, headingOf(at.x - this.#body.position.x, at.z - this.#body.position.z))
    if (Math.abs(off) <= HEAD_TURN) return this.#home
    return this.#home + Math.sign(off) * (Math.abs(off) - HEAD_TURN)
  }

  /** Where the head may look: the point itself, or as far round towards it as a head goes. */
  #look(at: THREE.Vector3): THREE.Vector3 {
    const dx = at.x - this.#body.position.x
    const dz = at.z - this.#body.position.z
    const away = Math.hypot(dx, dz)
    const off = angleDelta(this.#body.rotation.y, headingOf(dx, dz))
    if (away < 1e-6 || Math.abs(off) <= HEAD_TURN) return this.#aim.set(at.x, at.y, at.z)
    const yaw = this.#body.rotation.y + Math.sign(off) * HEAD_TURN
    return this.#aim.set(this.#body.position.x - Math.sin(yaw) * away, at.y, this.#body.position.z - Math.cos(yaw) * away)
  }
}

/**
 * Whoever the player is talking to, turned to face them: the pedestrian stops
 * mid-route and comes round, the person behind the counter turns as far as
 * they need to, and both look the player in the eye until the conversation
 * ends. Who is talking is `@gb/talk`'s business; this is only what it looks
 * like from across the pavement.
 */
export class Attending {
  #street: Holder
  #post: (npcId: string) => Post | undefined
  #eye: THREE.Vector3
  #gone: () => void
  #held: Attention | undefined
  #anchored: Anchored | undefined

  constructor(input: {
    street: Holder
    post: (npcId: string) => Post | undefined
    eye: THREE.Vector3
    /** Whoever was being talked to is not out here any more. Nothing by default. */
    gone?: () => void
  }) {
    this.#street = input.street
    this.#post = input.post
    this.#eye = input.eye
    this.#gone = input.gone ?? (() => {})
  }

  /** Somebody has been spoken to. Whoever was listening before goes back to what they were doing. */
  hold(npcId: string): void {
    this.#anchored?.home()
    this.#anchored = undefined
    this.#held?.release()

    const held = this.#street.attend(npcId, this.#eye.x, this.#eye.y, this.#eye.z)
    this.#held = held?.held ? held : undefined
    if (this.#held) return
    const post = this.#post(npcId)
    if (post) this.#anchored = new Anchored(post)
  }

  /** One frame: keep whoever is listening pointed at the player, wherever they have moved to. */
  update(seconds: number): void {
    const held = this.#held
    // a hold does not pin somebody on the street forever: `@gb/crowd` retires
    // a walker who has been left far behind, hold and all, so walking away with
    // the panel still open ends the person and not only the hold
    if (held && !held.held) {
      this.#held = undefined
      this.#gone()
      return
    }
    held?.face(this.#eye.x, this.#eye.y, this.#eye.z)
    if (!this.#anchored) return
    this.#anchored.update(seconds, this.#eye)
    if (!this.#anchored.settled) return
    // the last hundredth of a radian is nothing to look at, but a body left off
    // its own bearing is a body that drifts a little further every conversation
    this.#anchored.home()
    this.#anchored = undefined
  }

  /** The conversation is over: they look away and go back to it. */
  release(): void {
    this.#held?.release()
    this.#held = undefined
    this.#anchored?.letGo()
  }
}
