import type { FurnitureProp } from '@gb/world'
import * as THREE from 'three'

const UNSCALED = new THREE.Vector3(1, 1, 1)

/** Where a prop stands and which way it is turned, with any scale on it left out. */
interface Stance {
  readonly x: number
  readonly z: number
  readonly yaw: number
  readonly matrix: THREE.Matrix4
}

/**
 * The patch of floor one piece of furniture stands on, measured off the object
 * that was built rather than off a table of sizes, so it cannot disagree with
 * what the player can see.
 *
 * Interior coordinates and metres, the frame `entrance` and the anchors use.
 * `rot` is the three.js yaw the object carries, so the rectangle is turned the
 * way the furniture is: the half extents run along the prop's own axes, not
 * the world's.
 */
export class PropFootprint {
  readonly propId: string
  readonly prop: FurnitureProp
  /** Centre of the rectangle on the floor. */
  readonly x: number
  readonly z: number
  /** Half the rectangle across the prop's front, and half through it. */
  readonly halfWidth: number
  readonly halfDepth: number
  /** Three.js yaw in radians: the turn that takes the rectangle to where it stands. */
  readonly rot: number
  /** How far the piece stands above the floor, so a caller can tell a counter from a doormat. */
  readonly height: number

  constructor(propId: string, prop: FurnitureProp, object: THREE.Object3D) {
    const stance = stanceOf(object)
    const box = boundsIn(object, stance.matrix)
    const centre = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    this.propId = propId
    this.prop = prop
    this.rot = stance.yaw
    this.halfWidth = size.x / 2
    this.halfDepth = size.z / 2
    this.height = box.max.y

    // the middle of the geometry need not sit over the point the prop was
    // placed at, so carry that offset out through the same turn
    const cos = Math.cos(stance.yaw)
    const sin = Math.sin(stance.yaw)
    this.x = stance.x + centre.x * cos + centre.z * sin
    this.z = stance.z - centre.x * sin + centre.z * cos
  }

  /** Is this point on the floor inside the rectangle, for a walker `margin` wide? */
  contains(x: number, z: number, margin = 0): boolean {
    const local = this.local(x, z)
    return Math.abs(local.along) <= this.halfWidth + margin && Math.abs(local.through) <= this.halfDepth + margin
  }

  /** That point in the prop's own frame: signed, across its front and through it. */
  local(x: number, z: number): { along: number; through: number } {
    const cos = Math.cos(this.rot)
    const sin = Math.sin(this.rot)
    const dx = x - this.x
    const dz = z - this.z
    return { along: dx * cos - dz * sin, through: dx * sin + dz * cos }
  }

  /** A point in the prop's own frame, back in interior metres. */
  world(along: number, through: number): { x: number; z: number } {
    const cos = Math.cos(this.rot)
    const sin = Math.sin(this.rot)
    return { x: this.x + along * cos + through * sin, z: this.z - along * sin + through * cos }
  }

  /** Does the rectangle reach into that square of floor? Separating axes, so a turned rectangle answers honestly. */
  reaches(x: number, z: number, half: number): boolean {
    const dx = x - this.x
    const dz = z - this.z
    const local = this.local(x, z)
    const cos = Math.abs(Math.cos(this.rot))
    const sin = Math.abs(Math.sin(this.rot))
    // the square measured along the rectangle's axes, then the rectangle along the world's
    return (
      Math.abs(local.along) <= this.halfWidth + half * (cos + sin) &&
      Math.abs(local.through) <= this.halfDepth + half * (cos + sin) &&
      Math.abs(dx) <= half + this.halfWidth * cos + this.halfDepth * sin &&
      Math.abs(dz) <= half + this.halfWidth * sin + this.halfDepth * cos
    )
  }
}

function stanceOf(object: THREE.Object3D): Stance {
  object.updateWorldMatrix(true, true)
  const position = new THREE.Vector3()
  const turn = new THREE.Quaternion()
  object.matrixWorld.decompose(position, turn, new THREE.Vector3())
  const yaw = new THREE.Euler().setFromQuaternion(turn, 'YXZ').y
  // the frame sits on the floor under the prop, not at its base, so a piece
  // standing on a counter top measures its height from the floor like the rest
  const floor = new THREE.Vector3(position.x, 0, position.z)
  const matrix = new THREE.Matrix4().compose(floor, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), UNSCALED)
  return { x: position.x, z: position.z, yaw, matrix }
}

/** Every triangle the prop is drawn from, boxed in the frame it stands in. */
function boundsIn(object: THREE.Object3D, frame: THREE.Matrix4): THREE.Box3 {
  const intoFrame = frame.clone().invert()
  const bounds = new THREE.Box3()
  const part = new THREE.Box3()
  const matrix = new THREE.Matrix4()
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    part.copy(mesh.geometry.boundingBox!)
    part.applyMatrix4(matrix.multiplyMatrices(intoFrame, mesh.matrixWorld))
    bounds.union(part)
  })
  return bounds
}
