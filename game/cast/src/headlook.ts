import * as THREE from 'three'
import { restAxesOf, type BoneAxes } from './axes.ts'

/**
 * How far each bone in the chain may turn off the pose the clip put it in.
 * Together that is about 94 degrees of yaw and 52 of pitch, the chest turning
 * a little under the neck and the head: enough to notice somebody looking at
 * you, short of the head coming off.
 */
const CHAIN = [
  { bone: 'spine_03', yaw: 0.3, pitch: 0.1 },
  { bone: 'neck_01', yaw: 0.45, pitch: 0.3 },
  { bone: 'Head', yaw: 0.9, pitch: 0.5 },
] as const

/** Seconds for the look to reach the target, and to let go of it. */
const EASE = 0.22

interface Link extends BoneAxes {
  readonly yaw: number
  readonly pitch: number
}

/**
 * Turns a person's head toward a point in the world. It runs after the mixer
 * and rotates the neck and the head off whatever pose the clip left them in, so
 * it layers over standing, sitting or walking without a clip of its own.
 */
export class HeadLook {
  #links: Link[] = []
  #target = new THREE.Vector3()
  #wanted = 0
  #weight = 0
  #direction = new THREE.Vector3()
  #position = new THREE.Vector3()
  #rotation = new THREE.Quaternion()
  #turn = new THREE.Quaternion()
  #tilt = new THREE.Quaternion()

  /** Reads the rest pose, so the axes come from the rig rather than a guess. */
  constructor(root: THREE.Object3D) {
    for (const axes of restAxesOf(root, CHAIN.map((limit) => limit.bone))) {
      const limit = CHAIN.find((one) => one.bone === axes.bone.name)!
      this.#links.push({ ...axes, yaw: limit.yaw, pitch: limit.pitch })
    }
  }

  /** Look at a point in world space, and keep looking until told otherwise. */
  at(point: THREE.Vector3): void {
    this.#target.copy(point)
    this.#wanted = 1
  }

  /** Let the head ease back to whatever the clip is doing. */
  away(): void {
    this.#wanted = 0
  }

  /** True while there is still something to apply, easing out included. */
  get busy(): boolean {
    return this.#wanted > 0 || this.#weight > 1e-3
  }

  /** Run after the mixer, once per frame. */
  apply(seconds: number): void {
    this.#weight += (this.#wanted - this.#weight) * (1 - Math.exp(-seconds / EASE))
    if (this.#weight <= 1e-3) return

    for (const link of this.#links) {
      link.bone.updateWorldMatrix(true, false)
      link.bone.getWorldQuaternion(this.#rotation)
      link.bone.getWorldPosition(this.#position)

      this.#direction.copy(this.#target).sub(this.#position)
      if (this.#direction.lengthSq() < 1e-8) return
      this.#direction.normalize().applyQuaternion(this.#rotation.invert())

      const along = this.#direction.dot(link.forward)
      const side = this.#direction.dot(link.right)
      const rise = this.#direction.dot(link.up)
      const yaw = clamp(Math.atan2(side, along), link.yaw) * this.#weight
      // a turn about the right axis takes the face down, so the rise is negated
      const pitch = clamp(-Math.atan2(rise, Math.hypot(along, side)), link.pitch) * this.#weight

      this.#turn.setFromAxisAngle(link.up, yaw)
      this.#tilt.setFromAxisAngle(link.right, pitch)
      link.bone.quaternion.multiply(this.#turn.multiply(this.#tilt))
      // the next bone down the chain has to see this one's new pose
      link.bone.updateMatrixWorld(true)
    }
  }
}

function clamp(angle: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, angle))
}
