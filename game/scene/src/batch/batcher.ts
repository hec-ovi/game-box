import * as THREE from 'three'
import { batchFor, keyOf, MaterialBatch, type Placed } from './batch.ts'
import { partsOf, type Part } from './parts.ts'

/** One material's share of the city, waiting to be put in a buffer. */
interface Bucket {
  readonly material: THREE.Material
  readonly entries: Entry[]
  vertices: number
  indices: number
  castShadow: boolean
  receiveShadow: boolean
}

interface Entry {
  readonly plotId: string
  readonly geometry: THREE.BufferGeometry
  readonly at: THREE.Matrix4
}

/** One object standing in the city: what it occupies, and the two things that can be done to it. */
export interface Placing {
  /** The box it occupies, in city metres. */
  readonly bounds: THREE.Box3
  /** Draws it or not, without touching a buffer. */
  show(visible: boolean): void
  /** Takes it out of the city for good. */
  remove(): void
}

/** One part of an object, in one batch. */
class Piece {
  readonly #batch: MaterialBatch
  readonly #placed: Placed
  readonly #touched: (batch: MaterialBatch) => void

  constructor(batch: MaterialBatch, placed: Placed, touched: (batch: MaterialBatch) => void) {
    this.#batch = batch
    this.#placed = placed
    this.#touched = touched
  }

  show(visible: boolean): void {
    this.#batch.mesh.setVisibleAt(this.#placed.instance, visible)
  }

  remove(): void {
    ;(this.#batch.mesh.userData['plots'] as Array<string | undefined>)[this.#placed.instance] = undefined
    this.#batch.remove(this.#placed)
    this.#touched(this.#batch)
  }
}

/**
 * Lays objects out as one `BatchedMesh` per material, so a town of hundreds of
 * buildings costs as many draws as it has materials rather than as many as it
 * has buildings, in the shadow pass as well as the frame.
 *
 * Objects offered before `seal` are counted first and the buffers cut to fit;
 * one offered after it goes straight into the batch it belongs in, which is how
 * a city can gain a building without being rebuilt, and one taken out leaves
 * its range for the next. Order is the order they were offered, which is the
 * order the world lists its plots, so the same city batches the same way every
 * run.
 *
 * A batch's own bounds are measured again in `settle`, once for however many
 * pieces came and went since the last, rather than after each of them.
 */
export class CityBatcher {
  readonly #root: THREE.Group
  readonly #prefix: string
  #buckets = new Map<string, Bucket>()
  #batches = new Map<string, MaterialBatch>()
  readonly #touched = new Set<MaterialBatch>()
  #sealed = false

  /** `prefix` names the batches: `<prefix>:<material>`. */
  constructor(root: THREE.Group, prefix: string) {
    this.#root = root
    this.#prefix = prefix
  }

  /**
   * One object at one place. An object holding something a batch cannot draw
   * stands on its own in the city instead, and is still addressable. Before
   * `seal` the answer is undefined: the object is not in a buffer yet.
   */
  offer(plotId: string, object: THREE.Object3D, at: THREE.Matrix4): Placing | undefined {
    const parts = partsOf(object)
    if (!parts) return this.#standing(object, at)
    if (!this.#sealed) {
      for (const part of parts) this.#collect(plotId, part, at)
      return undefined
    }

    const bounds = new THREE.Box3()
    const pieces: Piece[] = []
    for (const part of parts) {
      const batch = this.#batchFor(part)
      pieces.push(this.#put(batch, part.geometry, at, plotId, bounds))
      this.#touched.add(batch)
    }
    return placingOf(bounds, pieces)
  }

  /** Measures every batch that changed since the last time, for the scene-wide cull. */
  settle(): void {
    for (const batch of this.#touched) batch.remeasure()
    this.#touched.clear()
  }

  /**
   * Cuts the buffers and fills them. Every bucket is let go of as it is copied,
   * rather than holding the whole city twice over.
   */
  seal(): ReadonlyMap<string, Placing> {
    const pieces = new Map<string, Piece[]>()
    const boxes = new Map<string, THREE.Box3>()
    let ordinal = 0

    for (const [key, bucket] of this.#buckets) {
      const batch = new MaterialBatch(this.#name(bucket.material, ordinal++), bucket.material, {
        instances: bucket.entries.length,
        vertices: bucket.vertices,
        indices: bucket.indices,
      })
      batch.mesh.castShadow = bucket.castShadow
      batch.mesh.receiveShadow = bucket.receiveShadow
      this.#open(key, batch)

      for (let at = 0; at < bucket.entries.length; at++) {
        const entry = bucket.entries[at]!
        let box = boxes.get(entry.plotId)
        if (!box) {
          box = new THREE.Box3()
          boxes.set(entry.plotId, box)
        }
        const piece = this.#put(batch, entry.geometry, entry.at, entry.plotId, box)
        const found = pieces.get(entry.plotId)
        if (found) found.push(piece)
        else pieces.set(entry.plotId, [piece])
        // let the source go as it is copied
        bucket.entries[at] = undefined as unknown as Entry
      }
      batch.remeasure()
    }

    this.#buckets = new Map()
    this.#sealed = true
    const placings = new Map<string, Placing>()
    for (const [plotId, list] of pieces) placings.set(plotId, placingOf(boxes.get(plotId)!, list))
    return placings
  }

  #standing(object: THREE.Object3D, at: THREE.Matrix4): Placing {
    object.applyMatrix4(at)
    this.#root.add(object)
    return {
      bounds: new THREE.Box3().setFromObject(object),
      show: (visible) => {
        object.visible = visible
      },
      remove: () => object.removeFromParent(),
    }
  }

  #collect(plotId: string, part: Part, at: THREE.Matrix4): void {
    const key = keyOf(part)
    let bucket = this.#buckets.get(key)
    if (!bucket) {
      bucket = { material: part.material, entries: [], vertices: 0, indices: 0, castShadow: false, receiveShadow: false }
      this.#buckets.set(key, bucket)
    }
    bucket.entries.push({ plotId, geometry: part.geometry, at })
    bucket.vertices += part.geometry.getAttribute('position').count
    bucket.indices += part.geometry.getIndex()?.count ?? 0
    bucket.castShadow ||= part.castShadow
    bucket.receiveShadow ||= part.receiveShadow
  }

  /** The batch this part belongs in, opened if the city has not seen its material yet. */
  #batchFor(part: Part): MaterialBatch {
    const key = keyOf(part)
    return this.#batches.get(key) ?? this.#open(key, batchFor(this.#name(part.material, this.#batches.size), part, 8))
  }

  #open(key: string, batch: MaterialBatch): MaterialBatch {
    batch.mesh.userData['plots'] = []
    this.#batches.set(key, batch)
    this.#root.add(batch.mesh)
    return batch
  }

  #name(material: THREE.Material, ordinal: number): string {
    return `${this.#prefix}:${material.name || ordinal}`
  }

  #put(batch: MaterialBatch, geometry: THREE.BufferGeometry, at: THREE.Matrix4, plotId: string, box: THREE.Box3): Piece {
    // measured on the small geometry and carried in, so the batch never has to
    // read its own buffer back to find out what it is holding
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    if (!geometry.boundingSphere) geometry.computeBoundingSphere()

    const placed = batch.add(geometry, at)
    ;(batch.mesh.userData['plots'] as string[])[placed.instance] = plotId
    box.union(geometry.boundingBox!.clone().applyMatrix4(at))
    return new Piece(batch, placed, (touched) => this.#touched.add(touched))
  }
}

function placingOf(bounds: THREE.Box3, pieces: readonly Piece[]): Placing {
  return {
    bounds,
    show: (visible) => {
      for (const piece of pieces) piece.show(visible)
    },
    remove: () => {
      for (const piece of pieces) piece.remove()
    },
  }
}

/** Which plot a hit on a batched building belongs to. */
export function plotOf(hit: THREE.Intersection): string | undefined {
  const plots = hit.object.userData['plots'] as Array<string | undefined> | undefined
  return plots && hit.batchId !== undefined ? plots[hit.batchId] : undefined
}
