import { Leash, type Attention } from '@gb/crowd'
import * as THREE from 'three'

/** Somebody the art pack can bring out of their stance to face whoever is speaking, and send back into it. */
export interface Attentive {
  attend(point: THREE.Vector3): void
  resume(): void
}

/** Somebody standing at their own post: a body that can turn and, with the art pack, a person who can come out of their stance. */
export interface Post {
  readonly body: THREE.Object3D
  readonly member?: Attentive
}

/** Whoever can hold a person on the street still. `Street` is the one. */
export interface Holder {
  attend(npcId: string, x: number, y: number, z: number): Attention | undefined
  /** How far the player may walk off before the conversation is over. */
  readonly talkRadius: number
}

/** How far a head turns off its own shoulders before the body has to come round with it, in radians. */
const HEAD_TURN = 1.25

/** How fast a body swings round, per radian it still has to turn, per second. */
const TURN_EASE = 8

/** However far there is to go, a body never turns faster than this, in radians per second. */
const TURN_QUICKEST = 4

/** Close enough to the way they were standing to call it done, in radians. */
const HOME = 0.01

/** How far the player moves before the person being spoken to is given the new point, in metres. */
const MOVED = 0.25

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
 * Somebody at a post the greybox drew: a body with no stance to leave, so
 * being talked to turns it, and only as far as it needs. The head does the
 * first three quarters of a right angle and the body brings the rest, so
 * nobody swings their back to the counter they are working at. Let go, they
 * come round to the way the room put them.
 */
class Turned {
  #body: THREE.Object3D
  #home: number
  #leaving = false

  constructor(body: THREE.Object3D) {
    this.#body = body
    this.#home = body.rotation.y
  }

  /** True once they are back the way they were standing and there is nothing left to do. */
  get settled(): boolean {
    return this.#leaving && Math.abs(angleDelta(this.#body.rotation.y, this.#home)) < HOME
  }

  /** One frame of paying attention to a point, or of coming back off it. */
  update(seconds: number, at: THREE.Vector3): void {
    this.#body.rotation.y = easeToward(this.#body.rotation.y, this.#leaving ? this.#home : this.#turn(at), seconds)
  }

  /** The conversation is over: start coming round. */
  letGo(): void {
    this.#leaving = true
  }

  /** Back on their post this instant, for when somebody else is spoken to before they got there. */
  home(): void {
    this.#leaving = true
    this.#body.rotation.y = this.#home
  }

  /** How far round they have to come: as little as leaves the point inside a head turn. */
  #turn(at: THREE.Vector3): number {
    const off = angleDelta(this.#home, headingOf(at.x - this.#body.position.x, at.z - this.#body.position.z))
    if (Math.abs(off) <= HEAD_TURN) return this.#home
    return this.#home + Math.sign(off) * (Math.abs(off) - HEAD_TURN)
  }
}

/**
 * Somebody at their post, dressed by the art pack: they come out of whatever
 * they were doing to face the player, and go back to it afterwards. The pack
 * turns the art inside the object and never moves the object, so the spot the
 * room measured for them stays measured. The point is handed over again as
 * the player walks, and not every frame, because each is a turn to ease into.
 */
class Listening {
  #member: Attentive
  #given = new THREE.Vector3()

  constructor(member: Attentive, at: THREE.Vector3) {
    this.#member = member
    this.#given.copy(at)
    member.attend(at)
  }

  update(at: THREE.Vector3): void {
    if (at.distanceToSquared(this.#given) < MOVED * MOVED) return
    this.#given.copy(at)
    this.#member.attend(at)
  }

  letGo(): void {
    this.#member.resume()
  }
}

/**
 * Whoever the player is talking to, turned to face them: the pedestrian stops
 * mid-route and comes round, the person behind the counter comes out of their
 * stance, and both look the player in the eye until the conversation ends.
 * Who is talking is `@gb/talk`'s business; this is only what it looks like
 * from across the pavement, and when walking off has ended it.
 */
export class Attending {
  #street: Holder
  #post: (npcId: string) => Post | undefined
  #eye: THREE.Vector3
  #gone: () => void
  #held: Attention | undefined
  #stationed: { at: THREE.Vector3; leash: Leash; facing: Listening | Turned } | undefined
  #turned: Turned | undefined

  constructor(input: {
    street: Holder
    post: (npcId: string) => Post | undefined
    eye: THREE.Vector3
    /** Whoever was being talked to is not in reach any more. Nothing by default. */
    gone?: () => void
  }) {
    this.#street = input.street
    this.#post = input.post
    this.#eye = input.eye
    this.#gone = input.gone ?? (() => {})
  }

  /** Somebody has been spoken to. Whoever was listening before goes back to what they were doing. */
  hold(npcId: string): void {
    this.release()
    this.#turned?.home()
    this.#turned = undefined

    const held = this.#street.attend(npcId, this.#eye.x, this.#eye.y, this.#eye.z)
    this.#held = held?.held ? held : undefined
    if (this.#held) return
    const post = this.#post(npcId)
    if (!post) return
    // the crowd has no body indoors, so the range that ends a conversation on
    // the pavement is measured here against the post, with the same number
    const leash = new Leash(this.#street.talkRadius)
    leash.reset()
    const facing = post.member ? new Listening(post.member, this.#eye) : new Turned(post.body)
    this.#stationed = { at: post.body.position, leash, facing }
  }

  /** One frame: keep whoever is listening pointed at the player, wherever they have moved to. */
  update(seconds: number): void {
    const held = this.#held
    // a hold does not pin somebody on the street forever: `@gb/crowd` lets a
    // walker go once the player has walked off, and retires one left far
    // behind, hold and all, so the panel closes on the person and not only on
    // the hold
    if (held && !held.held) {
      this.#held = undefined
      this.#gone()
      return
    }
    held?.face(this.#eye.x, this.#eye.y, this.#eye.z)

    const stationed = this.#stationed
    if (stationed) {
      if (stationed.leash.gone(this.#eye.x - stationed.at.x, this.#eye.z - stationed.at.z)) {
        this.#gone()
        return
      }
      if (stationed.facing instanceof Turned) stationed.facing.update(seconds, this.#eye)
      else stationed.facing.update(this.#eye)
    }

    if (!this.#turned) return
    this.#turned.update(seconds, this.#eye)
    if (!this.#turned.settled) return
    // the last hundredth of a radian is nothing to look at, but a body left off
    // its own bearing is a body that drifts a little further every conversation
    this.#turned.home()
    this.#turned = undefined
  }

  /** The conversation is over: they look away and go back to it. */
  release(): void {
    this.#held?.release()
    this.#held = undefined
    const stationed = this.#stationed
    this.#stationed = undefined
    if (!stationed) return
    stationed.facing.letGo()
    if (stationed.facing instanceof Turned) this.#turned = stationed.facing
  }
}
