import * as THREE from 'three'
import { batchFor, keyOf, MaterialBatch } from './batch/batch.ts'
import { partsOf, type Part } from './batch/parts.ts'

/** How many things a room is expected to hold before its batch has to grow. */
const ROOM_FOR = 8

/** Where an instance goes in before its thing is put anywhere: the batch matrix is written on every move. */
const IDENTITY = new THREE.Matrix4()

/**
 * Everything lying about in one room, in one `THREE.BatchedMesh` per material
 * rather than one object each, the same way the city holds its buildings. A
 * shelf of twenty things costs the draw one thing costs, and a model two items
 * share goes into the buffer once and is placed twice.
 *
 * Each thing still answers on its own. Its handle carries where it is, taking
 * that handle out of the room stops the batch drawing it, and a ray that lands
 * on the batch says which item it hit.
 *
 * A thing the room has held before keeps the handle and the buffer it had, so
 * picking something up and putting it down again moves the copy that is already
 * there rather than drawing a second one.
 *
 * A dressing may return whatever it likes: an object a batch cannot draw the
 * same way stands on its own in the room and is its own handle.
 */
export class Pickups {
  readonly #root: THREE.Group
  readonly #batches = new Map<string, Batch>()
  readonly #handles = new Map<string, THREE.Object3D>()

  constructor(root: THREE.Group) {
    this.#root = root
  }

  /** One thing lying at one place, base at that height. Answers its handle. */
  put(itemId: string, object: THREE.Object3D, at: THREE.Vector3): THREE.Object3D {
    const handle = this.#handles.get(itemId) ?? this.#hold(itemId, object)
    // a thing the batch draws moves by writing its instance matrices, because
    // its triangles are in the batch and not under the handle; one the batch
    // refused is its own object and moves the ordinary way
    if (handle instanceof Pickup) handle.moveTo(at)
    else handle.position.copy(at)
    this.#root.add(handle)
    return handle
  }

  /** Every thing in the room, by item id. */
  get all(): ReadonlyMap<string, THREE.Object3D> {
    return this.#handles
  }

  /** The handle to a thing the room has not held before: its triangles go into the buffer here, once. */
  #hold(itemId: string, object: THREE.Object3D): THREE.Object3D {
    const parts = partsOf(object)
    // an object no batch will take is put in the room whole and is its own handle
    const handle = parts?.length ? this.#batch(itemId, parts) : object
    handle.name = itemId
    handle.userData['itemId'] = itemId
    this.#handles.set(itemId, handle)
    return handle
  }

  #batch(itemId: string, parts: readonly Part[]): Pickup {
    const drawn: Drawn[] = []
    for (const part of parts) {
      const { batch, held } = this.#batchFor(part)
      const instance = batch.place(hold(batch, held, part.geometry), IDENTITY)
      ;(batch.mesh.userData['items'] as string[])[instance] = itemId
      drawn.push(new Drawn(batch, instance))
    }
    return new Pickup(drawn)
  }

  #batchFor(part: Part): Batch {
    const key = keyOf(part)
    let found = this.#batches.get(key)
    if (!found) {
      const batch = batchFor(`pickups:${part.material.name || this.#batches.size}`, part, ROOM_FOR)
      batch.mesh.userData['items'] = []
      found = { batch, held: new Map() }
      this.#batches.set(key, found)
      this.#root.add(batch.mesh)
    }
    return found
  }
}

/** One material's things, and which of its models are already in the buffer. */
interface Batch {
  readonly batch: MaterialBatch
  readonly held: Map<THREE.BufferGeometry, number>
}

/** The buffer this model already went into, or the copy that puts it there. */
function hold(batch: MaterialBatch, held: Map<THREE.BufferGeometry, number>, geometry: THREE.BufferGeometry): number {
  let already = held.get(geometry)
  if (already === undefined) {
    already = batch.hold(geometry)
    held.set(geometry, already)
  }
  return already
}

/** One instance in one batch: the triangles that draw a part of one thing. */
class Drawn {
  readonly #batch: MaterialBatch
  readonly #instance: number

  constructor(batch: MaterialBatch, instance: number) {
    this.#batch = batch
    this.#instance = instance
  }

  moveTo(matrix: THREE.Matrix4): void {
    this.#batch.mesh.setMatrixAt(this.#instance, matrix)
    this.#batch.remeasure()
  }

  show(visible: boolean): void {
    this.#batch.mesh.setVisibleAt(this.#instance, visible)
  }
}

/**
 * The handle to one thing lying about. Its triangles are in the room's batch,
 * so the handle is what takes the thing out of the room: remove it and the
 * batch stops drawing it, put it back and the thing is there again.
 *
 * Where it is drawn is the batch's instance matrix, so the handle's own
 * position is written through to the batch rather than being a transform
 * anything inherits: a handle moved and put back down is drawn where it was
 * moved to, not where it was first left.
 */
class Pickup extends THREE.Object3D {
  readonly #drawn: readonly Drawn[]

  constructor(drawn: readonly Drawn[]) {
    super()
    this.#drawn = drawn
    this.addEventListener('added', () => this.#show(true))
    this.addEventListener('removed', () => this.#show(false))
  }

  moveTo(at: THREE.Vector3): void {
    this.position.copy(at)
    const matrix = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z)
    for (const one of this.#drawn) one.moveTo(matrix)
  }

  #show(visible: boolean): void {
    for (const one of this.#drawn) one.show(visible)
  }
}

/**
 * Which item a hit landed on. Things in a room share buffers, so the object a
 * ray hits is a batch and this is what turns the hit back into an item.
 */
export function itemOf(hit: THREE.Intersection): string | undefined {
  const items = hit.object.userData['items'] as string[] | undefined
  if (items && hit.batchId !== undefined) return items[hit.batchId]
  for (let at: THREE.Object3D | null = hit.object; at; at = at.parent) {
    const itemId = at.userData['itemId'] as string | undefined
    if (itemId) return itemId
  }
  return undefined
}
