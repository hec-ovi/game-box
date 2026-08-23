import * as THREE from 'three'

/**
 * Collects primitives into one small geometry with a colour baked into its
 * vertices, so every piece of rubbish in the city can share one material and
 * one buffer while still being different colours.
 *
 * Flat shaded on purpose: a bin, a crate and a sack are faceted objects, and
 * not sharing vertices keeps every geometry the same shape of buffer, which is
 * what a `BatchedMesh` needs to hold them all together.
 */
export class Assembly {
  #positions: number[] = []
  #normals: number[] = []
  #uvs: number[] = []
  #colours: number[] = []

  /** One primitive, moved into place and painted. */
  add(shape: THREE.BufferGeometry, at: THREE.Matrix4, colour: THREE.Color): this {
    const flat = shape.index ? shape.toNonIndexed() : shape
    const position = flat.getAttribute('position')
    const normal = flat.getAttribute('normal')
    const uv = flat.getAttribute('uv')
    const rotation = new THREE.Matrix3().setFromMatrix4(at).invert().transpose()
    const point = new THREE.Vector3()
    const facing = new THREE.Vector3()

    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(at)
      facing.fromBufferAttribute(normal, i).applyMatrix3(rotation).normalize()
      this.#positions.push(point.x, point.y, point.z)
      this.#normals.push(facing.x, facing.y, facing.z)
      this.#uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0)
      this.#colours.push(colour.r, colour.g, colour.b)
    }
    if (flat !== shape) flat.dispose()
    shape.dispose()
    return this
  }

  /** A box, standing on the y given, turned about its own upright. */
  box(size: Size, at: Point, colour: THREE.Color, yaw = 0, tilt = 0): this {
    const matrix = new THREE.Matrix4()
      .makeRotationY(yaw)
      .multiply(new THREE.Matrix4().makeRotationX(tilt))
      .setPosition(at.x, at.y, at.z)
    return this.add(new THREE.BoxGeometry(size.x, size.y, size.z), matrix, colour)
  }

  /** A coil of cable or hose, lying flat. */
  ring(radius: number, thickness: number, at: Point, colour: THREE.Color, yaw = 0): this {
    const shape = new THREE.TorusGeometry(radius, thickness, 3, 8).rotateX(Math.PI / 2)
    return this.add(shape, new THREE.Matrix4().makeRotationY(yaw).setPosition(at.x, at.y, at.z), colour)
  }

  /** A scrap lying on the ground: two triangles, and the cheapest thing on the street. */
  plate(width: number, depth: number, at: Point, colour: THREE.Color, yaw = 0): this {
    const shape = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2)
    return this.add(shape, new THREE.Matrix4().makeRotationY(yaw).setPosition(at.x, at.y, at.z), colour)
  }

  /** Indexed, because that is the only thing a batch will hold. */
  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.#positions), 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.#normals), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.#uvs), 2))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.#colours), 3))
    geometry.setIndex([...Array(this.#positions.length / 3).keys()])
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }
}

export interface Size {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Point {
  readonly x: number
  readonly y: number
  readonly z: number
}
