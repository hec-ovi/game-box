import type { World } from '@gb/world'
import * as THREE from 'three'
import type { Dressing } from './dressing.ts'
import type { Pickups } from './pickups.ts'
import type { PropSurface } from './surface.ts'

/** A step to the side of whoever is standing there, so a thing is not left inside them. */
const BESIDE = 0.45

/**
 * Leaving a thing at an anchor: on the piece of furniture that anchor belongs
 * to, at the height that piece is drawn to, beside whoever is standing there
 * rather than inside them.
 *
 * One rule, called twice. The generator's own placements come through here
 * while the room is being built, and so does anything the player puts down
 * afterwards, so a thing left later lands exactly where it would have been
 * built.
 */
export class Leaving {
  readonly #world: World
  readonly #dressing: Dressing
  readonly #pickups: Pickups
  readonly #spots: ReadonlyMap<string, THREE.Object3D>
  readonly #hosts: ReadonlyMap<string, PropSurface>

  constructor(
    world: World,
    dressing: Dressing,
    pickups: Pickups,
    spots: ReadonlyMap<string, THREE.Object3D>,
    hosts: ReadonlyMap<string, PropSurface>,
  ) {
    this.#world = world
    this.#dressing = dressing
    this.#pickups = pickups
    this.#spots = spots
    this.#hosts = hosts
  }

  /**
   * Leaves that thing at that anchor and answers its handle. An anchor with no
   * furniture behind it leaves the thing on the floor, which is the only
   * surface there is. An anchor this room has not got, or an item this world
   * has not got, draws nothing and answers nothing.
   */
  leave(itemId: string, anchorId: string): THREE.Object3D | undefined {
    const spot = this.#spots.get(anchorId)
    const item = this.#world.item(itemId)
    if (!spot || !item) return undefined

    const object = this.#dressing.pickup(item)
    return this.#pickups.put(item.id, object, this.#standing(spot, this.#hosts.get(anchorId), object))
  }

  /** Where the thing comes to rest: beside the anchor, then brought onto the piece behind it. */
  #standing(spot: THREE.Object3D, host: PropSurface | undefined, object: THREE.Object3D): THREE.Vector3 {
    const right = new THREE.Vector3(1, 0, 0).applyEuler(spot.rotation)
    const beside = { x: spot.position.x + right.x * BESIDE, z: spot.position.z + right.z * BESIDE }
    return host ? host.place(beside.x, beside.z, halfOf(object)) : new THREE.Vector3(beside.x, 0, beside.z)
  }
}

/** How far the thing reaches either side of its own centre, so it can be kept on the surface. */
function halfOf(object: THREE.Object3D): { x: number; z: number } {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return { x: 0, z: 0 }
  const size = box.getSize(new THREE.Vector3())
  return { x: size.x / 2, z: size.z / 2 }
}
