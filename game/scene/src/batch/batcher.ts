import * as THREE from 'three'
import { batchFor, keyOf, MaterialBatch } from './batch.ts'
import { CityBuilding } from './building.ts'
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

/** Puts one of a building's parts into the city, or takes it out. */
type Show = (visible: boolean) => void

/**
 * Lays the city's buildings out as one `BatchedMesh` per material, so a town of
 * hundreds of buildings costs as many draws as it has materials rather than as
 * many as it has buildings, in the shadow pass as well as the frame.
 *
 * Buildings offered before `seal` are counted first and the buffers cut to fit;
 * one offered after it goes straight into the batch it belongs in, which is how
 * a city can gain a building without being rebuilt. Order is the order they
 * were offered, which is the order the world lists its plots, so the same city
 * batches the same way every run.
 */
export class CityBatcher {
  readonly #root: THREE.Group
  #buckets = new Map<string, Bucket>()
  #batches = new Map<string, MaterialBatch>()
  #buildings = new Map<string, CityBuilding>()
  #sealed = false

  constructor(root: THREE.Group) {
    this.#root = root
  }

  /**
   * One building at one place. An object holding something a batch cannot draw
   * stands on its own in the city instead, and is still addressable. Before
   * `seal` the answer is undefined: the building is not in a buffer yet.
   */
  offer(plotId: string, object: THREE.Object3D, at: THREE.Matrix4): CityBuilding | undefined {
    const parts = partsOf(object)
    if (!parts) {
      object.applyMatrix4(at)
      this.#root.add(object)
      return this.#remember(plotId, new THREE.Box3().setFromObject(object), [(visible) => { object.visible = visible }])
    }
    if (!this.#sealed) {
      for (const part of parts) this.#collect(plotId, part, at)
      return undefined
    }

    const box = new THREE.Box3()
    const shows: Show[] = []
    for (const part of parts) {
      const batch = this.#batchFor(part)
      shows.push(this.#put(batch, part.geometry, at, plotId, box))
      batch.remeasure()
    }
    return this.#remember(plotId, box, shows)
  }

  /**
   * Cuts the buffers and fills them. Every bucket is let go of as it is copied,
   * rather than holding the whole city twice over.
   */
  seal(): ReadonlyMap<string, CityBuilding> {
    const shows = new Map<string, Show[]>()
    const boxes = new Map<string, THREE.Box3>()
    let ordinal = 0

    for (const [key, bucket] of this.#buckets) {
      const batch = new MaterialBatch(`city:${bucket.material.name || ordinal++}`, bucket.material, {
        instances: bucket.entries.length,
        vertices: bucket.vertices,
        indices: bucket.indices,
      })
      batch.mesh.castShadow = bucket.castShadow
      batch.mesh.receiveShadow = bucket.receiveShadow
      batch.mesh.userData['plots'] = []
      this.#batches.set(key, batch)
      this.#root.add(batch.mesh)

      for (let at = 0; at < bucket.entries.length; at++) {
        const entry = bucket.entries[at]!
        let box = boxes.get(entry.plotId)
        if (!box) {
          box = new THREE.Box3()
          boxes.set(entry.plotId, box)
        }
        const show = this.#put(batch, entry.geometry, entry.at, entry.plotId, box)
        const found = shows.get(entry.plotId)
        if (found) found.push(show)
        else shows.set(entry.plotId, [show])
        // let the source go as it is copied
        bucket.entries[at] = undefined as unknown as Entry
      }
      batch.remeasure()
    }

    this.#buckets = new Map()
    this.#sealed = true
    for (const [plotId, list] of shows) this.#remember(plotId, boxes.get(plotId)!, list)
    return this.#buildings
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
    let batch = this.#batches.get(key)
    if (!batch) {
      batch = batchFor(`city:${part.material.name || this.#batches.size}`, part, 8)
      batch.mesh.userData['plots'] = []
      this.#batches.set(key, batch)
      this.#root.add(batch.mesh)
    }
    return batch
  }

  #put(batch: MaterialBatch, geometry: THREE.BufferGeometry, at: THREE.Matrix4, plotId: string, box: THREE.Box3): Show {
    // measured on the small geometry and carried in, so the batch never has to
    // read its own buffer back to find out what it is holding
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    if (!geometry.boundingSphere) geometry.computeBoundingSphere()

    const instanceId = batch.add(geometry, at)
    ;(batch.mesh.userData['plots'] as string[])[instanceId] = plotId
    box.union(geometry.boundingBox!.clone().applyMatrix4(at))
    return (visible) => batch.mesh.setVisibleAt(instanceId, visible)
  }

  #remember(plotId: string, bounds: THREE.Box3, shows: readonly Show[]): CityBuilding {
    const building = new CityBuilding(plotId, bounds, (visible) => {
      for (const show of shows) show(visible)
    })
    this.#buildings.set(plotId, building)
    return building
  }
}

/** Which plot a hit on a batched building belongs to. */
export function plotOf(hit: THREE.Intersection): string | undefined {
  const plots = hit.object.userData['plots'] as string[] | undefined
  return plots && hit.batchId !== undefined ? plots[hit.batchId] : undefined
}
