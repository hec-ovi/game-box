import * as THREE from 'three'
import type { Part } from './parts.ts'

/** How much room a batch leaves when it has to grow, so growing is not once per building. */
const GROWTH = 1.5

/** One piece of geometry standing in a batch: the buffer it went into and the copy that draws it. */
export interface Placed {
  readonly geometry: number
  readonly instance: number
}

/**
 * Everything in the city drawn with one material, in one `BatchedMesh`.
 *
 * One draw covers the lot, and every piece in it keeps its own transform, its
 * own bounds and its own visibility, so three still culls each building against
 * the frustum and submits only the ranges that survive, in the shadow pass as
 * well as the frame. A static merge would cost the same one draw and hand the
 * whole city to the rasteriser every time.
 *
 * A piece taken out leaves its range behind; the range is reclaimed, by packing
 * the buffer once, only when the next piece would not fit otherwise, so a batch
 * that things come and go from settles at the size of what it holds at once.
 */
export class MaterialBatch {
  readonly mesh: THREE.BatchedMesh
  /** Vertices and indices written so far, freed ranges included. */
  #used = { vertices: 0, indices: 0 }
  /** What has been taken out and not packed away yet. */
  #freed = { vertices: 0, indices: 0 }
  #room: { vertices: number; indices: number }

  constructor(name: string, material: THREE.Material, room: { instances: number; vertices: number; indices: number }) {
    this.mesh = new THREE.BatchedMesh(room.instances, room.vertices, room.indices, material)
    this.mesh.name = name
    this.#room = { vertices: room.vertices, indices: room.indices }
  }

  /** Puts one piece of geometry in at one place, and answers where it landed. */
  add(geometry: THREE.BufferGeometry, at: THREE.Matrix4): Placed {
    const held = this.hold(geometry)
    return { geometry: held, instance: this.place(held, at) }
  }

  /** Takes one piece out: its copy stops being drawn and its range is free to be reclaimed. */
  remove(placed: Placed): void {
    const range = this.mesh.getGeometryRangeAt(placed.geometry)
    this.mesh.deleteGeometry(placed.geometry)
    if (!range) return
    this.#freed.vertices += range.reservedVertexCount
    this.#freed.indices += range.reservedIndexCount
  }

  /**
   * Copies one geometry into the buffer and answers its id. A batch that draws
   * the same model many times holds it once and places it many times; a batch
   * of buildings, where every geometry is different, holds each of them once.
   */
  hold(geometry: THREE.BufferGeometry): number {
    const vertices = geometry.getAttribute('position').count
    const indices = geometry.getIndex()?.count ?? 0
    this.#makeRoomFor(vertices, indices)
    this.#used.vertices += vertices
    this.#used.indices += indices
    return this.mesh.addGeometry(geometry)
  }

  /** One more copy of a geometry the batch already holds, at one place. */
  place(geometry: number, at: THREE.Matrix4): number {
    if (this.mesh.instanceCount >= this.mesh.maxInstanceCount) {
      this.mesh.setInstanceCount(Math.ceil(this.mesh.maxInstanceCount * GROWTH) + 1)
    }
    const id = this.mesh.addInstance(geometry)
    this.mesh.setMatrixAt(id, at)
    return id
  }

  /** The batch's own bounds, for the scene-wide cull. Call it after adding or removing. */
  remeasure(): THREE.BatchedMesh {
    this.mesh.computeBoundingSphere()
    this.mesh.computeBoundingBox()
    return this.mesh
  }

  #makeRoomFor(vertices: number, indices: number): void {
    if (this.#fits(vertices, indices)) return

    // pack what was taken out before asking for a bigger buffer
    if (this.#freed.vertices > 0 || this.#freed.indices > 0) {
      this.mesh.optimize()
      this.#used.vertices -= this.#freed.vertices
      this.#used.indices -= this.#freed.indices
      this.#freed = { vertices: 0, indices: 0 }
      if (this.#fits(vertices, indices)) return
    }

    this.#room = {
      vertices: Math.ceil((this.#used.vertices + vertices) * GROWTH),
      indices: Math.ceil((this.#used.indices + indices) * GROWTH),
    }
    this.mesh.setGeometrySize(this.#room.vertices, this.#room.indices)
  }

  #fits(vertices: number, indices: number): boolean {
    return this.#used.vertices + vertices <= this.#room.vertices && this.#used.indices + indices <= this.#room.indices
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

/**
 * A batch sized to hold that many copies of one part, named for what it draws.
 * It grows past the estimate on its own, so the number only decides how often.
 */
export function batchFor(name: string, part: Part, copies: number): MaterialBatch {
  const batch = new MaterialBatch(name, part.material, {
    instances: copies,
    vertices: part.geometry.getAttribute('position').count * copies,
    indices: (part.geometry.getIndex()?.count ?? 0) * copies,
  })
  batch.mesh.castShadow = part.castShadow
  batch.mesh.receiveShadow = part.receiveShadow
  return batch
}

/** Which batch a part belongs in: its material, and the attributes it agrees on. */
export function keyOf(part: Part): string {
  return `${part.material.uuid}|${shapeOf(part.geometry)}`
}
