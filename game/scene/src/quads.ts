import * as THREE from 'three'

/** One corner of a quad: where it is in metres, and where the texture sits on it, also in metres. */
export interface Corner {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly u: number
  readonly v: number
}

export interface Direction {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * Collects quads into one buffer geometry. Positions and UVs are both in
 * metres, so a texture tiles at a real-world size wherever it lands.
 */
export class QuadMesh {
  #positions: number[] = []
  #normals: number[] = []
  #uvs: number[] = []

  get empty(): boolean {
    return this.#positions.length === 0
  }

  /** Four corners anticlockwise seen from the front, and the way that front looks. */
  add(corners: readonly [Corner, Corner, Corner, Corner], normal: Direction): void {
    const [a, b, c, d] = corners
    for (const corner of [a, b, c, a, c, d]) {
      this.#positions.push(corner.x, corner.y, corner.z)
      this.#normals.push(normal.x, normal.y, normal.z)
      this.#uvs.push(corner.u, corner.v)
    }
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.#positions), 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.#normals), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.#uvs), 2))
    return geometry
  }
}
