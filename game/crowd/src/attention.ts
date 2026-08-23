import { angleDelta, headingOf } from './geometry.ts'

/**
 * How far a head turns off its own shoulders before the body has to come round
 * with it, in radians. A person glances over their shoulder; they do not swivel
 * their head to look behind them. Inside `@gb/cast`'s own head limit, so this
 * is the one that decides.
 */
export const HEAD_TURN = 1.25

/** How fast the body swings round, per radian it still has to turn, per second. */
export const TURN_EASE = 8

/** However far there is to go, the body never turns faster than this, in radians per second. */
export const TURN_QUICKEST = 4

/** Within this much of where they meant to face, the turn is done, in radians. */
export const TURNED = 0.25

/** A point in the world with a height: somebody's eyes, in metres, Y up. */
export interface Spot {
  x: number
  y: number
  z: number
}

/**
 * A hold on somebody: they stand still and face the point you give them until
 * you let go, and then they carry on with whatever they were doing. Holding
 * somebody who has since gone home does nothing, so a hold is safe to keep for
 * as long as the conversation lasts.
 *
 * It is not a handle on their body: `SceneCast.members()` is the one of those,
 * keyed by the same id, so a body is reached the same way indoors and out.
 */
export interface Attention {
  /** Turn to face this point, in metres. Call it again as the player moves. */
  face(x: number, y: number, z: number): void
  /** Let them go. */
  release(): void
  /** False once the hold is over: let go of, or they have gone home. */
  readonly held: boolean
}

/** Somebody a hold can be taken on. A `Walker` is one. */
export interface Attender {
  attend(x: number, y: number, z: number): void
  unattend(): void
  /** True once their body has been handed back: nothing more will happen to them. */
  readonly gone: boolean
}

/** A hold on nobody, for an id the crowd has never heard of. Callers never have to check. */
export const NOBODY: Attention = {
  held: false,
  face(): void {},
  release(): void {},
}

/** One person held still. Let go of once, and gone the moment they are retired. */
export class Hold implements Attention {
  #who: Attender | undefined

  constructor(who: Attender) {
    this.#who = who
  }

  get held(): boolean {
    return this.#who !== undefined && !this.#who.gone
  }

  face(x: number, y: number, z: number): void {
    if (this.held) this.#who!.attend(x, y, z)
  }

  release(): void {
    const who = this.#who
    this.#who = undefined
    if (who && !who.gone) who.unattend()
  }
}

/**
 * Where a body standing here and facing this way may look: the point itself, or
 * the nearest one its head reaches without the body coming round. Written into
 * `out`, so watching somebody costs no allocation a frame.
 */
export function headAim(fromX: number, fromZ: number, heading: number, at: Spot, out: Spot): void {
  out.y = at.y
  const dx = at.x - fromX
  const dz = at.z - fromZ
  const away = Math.hypot(dx, dz)
  const off = angleDelta(heading, headingOf(dx, dz))
  if (away < 1e-6 || Math.abs(off) <= HEAD_TURN) {
    out.x = at.x
    out.z = at.z
    return
  }
  // as far round as the head goes, and the body brings the rest
  const yaw = heading + Math.sign(off) * HEAD_TURN
  out.x = fromX - Math.sin(yaw) * away
  out.z = fromZ - Math.cos(yaw) * away
}
