import * as THREE from 'three'

/** How much room a batch leaves when it has to grow, so growing is not once per building. */
const GROWTH = 1.5

/**
 * Everything in the city drawn with one material, in one `BatchedMesh`.
 *
 * One draw covers the lot, and every piece in it keeps its own transform, its
 * own bounds and its own visibility, so three still culls each building against
 * the frustum and submits only the ranges that survive, in the shadow pass as
 * well as the frame. A static merge would cost the same one draw and hand the
 * whole city to the rasteriser every time.
 */
export class MaterialBatch {
  readonly mesh: THREE.BatchedMesh
  #vertices = 0
  #indices = 0
  #room: { vertices: number; indices: number }

  constructor(name: string, material: THREE.Material, room: { instances: number; vertices: number; indices: number }) {
    this.mesh = new THREE.BatchedMesh(room.instances, room.vertices, room.indices, material)
    this.mesh.name = name
    this.#room = { vertices: room.vertices, indices: room.indices }
  }

  /** Puts one piece of geometry in at one place, and answers where it landed. */
  add(geometry: THREE.BufferGeometry, at: THREE.Matrix4): number {
    const vertices = geometry.getAttribute('position').count
    const indices = geometry.getIndex()?.count ?? 0
    this.#makeRoomFor(vertices, indices)

    const id = this.mesh.addInstance(this.mesh.addGeometry(geometry))
    this.mesh.setMatrixAt(id, at)
    this.#vertices += vertices
    this.#indices += indices
    return id
  }

  /** The batch's own bounds, for the scene-wide cull. Call it after adding. */
  remeasure(): THREE.BatchedMesh {
    this.mesh.computeBoundingSphere()
    this.mesh.computeBoundingBox()
    return this.mesh
  }

  #makeRoomFor(vertices: number, indices: number): void {
    if (this.mesh.instanceCount >= this.mesh.maxInstanceCount) {
      this.mesh.setInstanceCount(Math.ceil(this.mesh.maxInstanceCount * GROWTH) + 1)
    }
    if (this.#vertices + vertices <= this.#room.vertices && this.#indices + indices <= this.#room.indices) return

    this.#room = {
      vertices: Math.ceil((this.#vertices + vertices) * GROWTH),
      indices: Math.ceil((this.#indices + indices) * GROWTH),
    }
    this.mesh.setGeometrySize(this.#room.vertices, this.#room.indices)
  }
}

/**
 * What a batch has to hold. Two geometries only share a batch when they agree
 * attribute for attribute, so a pane carrying the room behind it never lands in
 * the same buffer as a blank wall on the same material.
 */
export function shapeOf(geometry: THREE.BufferGeometry): string {
  const attributes = Object.keys(geometry.attributes).sort()
    .map((name) => `${name}:${geometry.getAttribute(name).itemSize}`)
  return `${attributes.join(',')}|${geometry.getIndex() ? 'indexed' : 'none'}`
}
