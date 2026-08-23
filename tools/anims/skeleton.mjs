/**
 * Forward kinematics over a clip, one keyframe at a time.
 *
 * A pose offset is written the way a person describes it ("tip the chest back
 * ten degrees"), which is an axis in the character's own frame, not in the
 * parent bone's. Turning one into the other needs the parent's world rotation
 * at that moment, so this walks the rig down from the root at every keyframe.
 */

/** Quaternion product, both as [x, y, z, w]. */
export function multiply(a, b) {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export function conjugate([x, y, z, w]) {
  return [-x, -y, -z, w]
}

/** A turn of `degrees` about a unit axis, as a quaternion. */
export function turn(axis, degrees) {
  const half = (degrees * Math.PI) / 360
  const s = Math.sin(half)
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
}

/** A vector through a rotation. */
export function rotate([x, y, z], [qx, qy, qz, qw]) {
  const tx = 2 * (qy * z - qz * y)
  const ty = 2 * (qz * x - qx * z)
  const tz = 2 * (qx * y - qy * x)
  return [
    x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz,
    z + qw * tz + qx * ty - qy * tx,
  ]
}

/**
 * The rig of one clip: who each bone hangs off, and where every bone points at
 * a given keyframe. Built once per source clip and read by the deriver.
 */
export class Skeleton {
  #order = []
  #parent = new Map()
  #rotation = new Map()
  #restRotation = new Map()

  /**
   * @param {import('@gltf-transform/core').Node} top the node the rig hangs off
   * @param {Map<string, Float32Array>} rotations one bone's rotation track, four numbers a keyframe
   */
  constructor(top, rotations) {
    const walk = (node, parent) => {
      const name = node.getName()
      this.#order.push(name)
      this.#parent.set(name, parent)
      this.#restRotation.set(name, node.getRotation())
      const track = rotations.get(name)
      if (track) this.#rotation.set(name, track)
      for (const child of node.listChildren()) walk(child, name)
    }
    walk(top, undefined)
  }

  get bones() {
    return this.#order
  }

  parentOf(bone) {
    return this.#parent.get(bone)
  }

  /** Every bone's world rotation at one keyframe, keyed by bone name. */
  worldRotations(frame) {
    const world = new Map()
    for (const bone of this.#order) {
      const track = this.#rotation.get(bone)
      const local = track
        ? [track[frame * 4], track[frame * 4 + 1], track[frame * 4 + 2], track[frame * 4 + 3]]
        : this.#restRotation.get(bone)
      const parent = this.#parent.get(bone)
      world.set(bone, parent === undefined ? local : multiply(world.get(parent), local))
    }
    return world
  }
}
