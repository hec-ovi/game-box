import * as THREE from 'three'
import { restAxesOf, type BoneAxes } from './axes.ts'

/**
 * The beat of a talking head, in degrees and hertz. The nod runs near the
 * rate of stressed syllables, the sway under it, and both are scaled by how
 * much of the line is arriving right now.
 */
const BEAT = { pitch: 3.5, yaw: 2.5, roll: 1.2, nod: 3.1, sway: 1.7 }

/** How much of the beat each bone carries. */
const SHARES: ReadonlyArray<readonly [string, number]> = [
  ['neck_01', 0.35],
  ['Head', 1],
]

/** Seconds for the energy of one chunk of text to fade, so a stalled reply goes still. */
const DECAY = 0.35

/** What one chunk adds to the energy, which tops out at one. */
const PER_CHUNK = 0.4

/** How much of the hands play while the line is being waited for. */
const WAITING = 0.3

/** Seconds for the hands to come up and to let go. */
const EASE = 0.15

const RADIAN = Math.PI / 180

/**
 * Somebody talking, timed to the words as they arrive. The rig has no jaw and
 * no mouth shape (the 65 joints end at `Head`, no mesh carries a morph
 * target), so the speech is on the head: a beat that rises with every chunk
 * of the reply and dies within half a second of the chunks stopping, and a
 * level for the talk gesture on the hands, up while the line lasts. Runs
 * after the mixer, over whatever the clip and the look left the head at.
 */
export class Speech {
  #links: BoneAxes[]
  #on = false
  #energy = 0
  #level = 0
  #time: number
  #turn = new THREE.Quaternion()
  #tilt = new THREE.Quaternion()
  #lean = new THREE.Quaternion()

  /** `phase` in [0,1) staggers the beat so a room of talkers is not in step. */
  constructor(root: THREE.Object3D, phase: number) {
    this.#links = restAxesOf(
      root,
      SHARES.map(([bone]) => bone),
    )
    this.#time = phase * 10
  }

  get on(): boolean {
    return this.#on
  }

  /** How much of the talk gesture to play right now: waiting, then with the stream. */
  get level(): number {
    return this.#level
  }

  /** True while there is still something to apply, easing out included. */
  get busy(): boolean {
    return this.#on || this.#level > 1e-3 || this.#energy > 1e-3
  }

  start(): void {
    this.#on = true
  }

  stop(): void {
    this.#on = false
  }

  /** A chunk of the line arrived. */
  pulse(): void {
    if (this.#on) this.#energy = Math.min(1, this.#energy + PER_CHUNK)
  }

  /** Run after the mixer, once per frame. */
  apply(seconds: number): void {
    this.#time += seconds
    this.#energy *= Math.exp(-seconds / DECAY)
    const wanted = this.#on ? Math.max(WAITING, this.#energy) : 0
    this.#level += (wanted - this.#level) * (1 - Math.exp(-seconds / EASE))
    if (this.#energy <= 1e-3) return

    const nod = Math.sin(2 * Math.PI * BEAT.nod * this.#time)
    const sway = Math.sin(2 * Math.PI * BEAT.sway * this.#time + 1)
    for (const [index, link] of this.#links.entries()) {
      const share = this.#energy * SHARES[index]![1] * RADIAN
      this.#tilt.setFromAxisAngle(link.right, BEAT.pitch * nod * share)
      this.#turn.setFromAxisAngle(link.up, BEAT.yaw * sway * share)
      this.#lean.setFromAxisAngle(link.forward, BEAT.roll * sway * nod * share)
      link.bone.quaternion.multiply(this.#turn.multiply(this.#tilt).multiply(this.#lean))
      link.bone.updateMatrixWorld(true)
    }
  }
}
