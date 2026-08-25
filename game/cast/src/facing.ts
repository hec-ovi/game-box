import * as THREE from 'three'

/** Seconds for a turn of the body to settle. */
const EASE = 0.3

/**
 * Turns the art inside the object the game moves, so a person can face
 * whoever is talking to them without their position or the object's heading
 * changing hands. The art is held at half a turn inside the object (it faces
 * +Z in its own files); this eases an offset on top of that.
 */
export class Facing {
  #body: THREE.Object3D
  #rest: number
  #wanted = 0
  #current = 0
  #local = new THREE.Vector3()

  constructor(body: THREE.Object3D, rest: number) {
    this.#body = body
    this.#rest = rest
  }

  /** Turn toward a point in world space. */
  toward(point: THREE.Vector3): void {
    const parent = this.#body.parent
    if (!parent) return
    parent.updateWorldMatrix(true, false)
    this.#local.copy(point)
    parent.worldToLocal(this.#local)
    // the object faces -Z at yaw 0, so a point straight ahead is at -z
    this.#wanted = Math.atan2(-this.#local.x, -this.#local.z)
  }

  /** Face the way the object faces again. */
  ahead(): void {
    this.#wanted = 0
  }

  get busy(): boolean {
    return Math.abs(this.#wanted - this.#current) > 1e-3
  }

  apply(seconds: number): void {
    let gap = this.#wanted - this.#current
    gap = Math.atan2(Math.sin(gap), Math.cos(gap))
    this.#current += gap * (1 - Math.exp(-seconds / EASE))
    this.#body.rotation.y = this.#rest + this.#current
  }
}
