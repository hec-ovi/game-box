import type { Dressing } from '@gb/scene'
import type { Item } from '@gb/world'
import * as THREE from 'three'
import type { Stage } from './stage.ts'

/** How many views make a turn. Fifteen degrees apart: a drag reads as turning rather than as flicking between pictures. */
const VIEWS = 24

/** How wide a view comes out. The panel holds it at 180 px, so this is two device pixels with room to spare. */
const SIZE = 256

/** Air round the thing in frame, as a share of its own size. */
const MARGIN = 1.25

/** A narrow lens, so a thing near the camera is not bent out towards it. */
const LENS = 30

/**
 * Every side of a thing the player is holding, drawn once.
 *
 * The interface has no renderer and is drawn over one that is already busy, so
 * a live turntable would be a second renderer or a readback a frame. This draws
 * the object once from `VIEWS` angles and hands the pictures over; the panel
 * walks them as the player drags, which reads as turning it and costs nothing
 * a frame.
 *
 * It is the same object the city puts on a shelf, from the same dressing, so
 * what was picked up and what is being looked at are one thing. Drawn once per
 * item and kept: opening the same thing again is the pictures it already has.
 */
export class Turntable {
  #dressing: Dressing
  #stage: Stage
  #scene = new THREE.Scene()
  #camera = new THREE.PerspectiveCamera(LENS, 1, 0.01, 100)
  #turned = new Map<string, readonly string[]>()
  #turning = new Map<string, Promise<readonly string[]>>()

  constructor(input: { dressing: Dressing; stage: Stage }) {
    this.#dressing = input.dressing
    this.#stage = input.stage
    // lit from the front and above with a fill under, the same for everything,
    // so a thing is not dark because of the hour it was picked up
    const key = new THREE.DirectionalLight(0xfff4e2, 2.6)
    key.position.set(0.7, 1.4, 1.6)
    const fill = new THREE.DirectionalLight(0xbfd8ea, 0.9)
    fill.position.set(-1, -0.3, 1)
    this.#scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.5))
  }

  /** Every side of it, drawn if they have not been. An empty list where it cannot be drawn. */
  async of(item: Item): Promise<readonly string[]> {
    const done = this.#turned.get(item.id)
    if (done) return done
    const already = this.#turning.get(item.id)
    if (already) return already
    const turning = this.#draw(item).finally(() => this.#turning.delete(item.id))
    this.#turning.set(item.id, turning)
    return turning
  }

  async #draw(item: Item): Promise<readonly string[]> {
    let object: THREE.Object3D | undefined
    try {
      object = this.#dressing.pickup(item)
    } catch (cause) {
      console.warn(`nothing to draw for ${item.id}`, cause)
    }
    if (!object) {
      this.#turned.set(item.id, [])
      return []
    }

    const spin = new THREE.Group()
    spin.add(object)
    this.#scene.add(spin)
    try {
      this.#frame(spin)
      const views: string[] = []
      for (let view = 0; view < VIEWS; view++) {
        spin.rotation.y = (view / VIEWS) * Math.PI * 2
        spin.updateMatrixWorld(true)
        const drawn = await this.#stage.snapshot(this.#scene, this.#camera, SIZE)
        // one view that will not draw means none of them will
        if (!drawn) break
        views.push(drawn)
      }
      this.#turned.set(item.id, views)
      return views
    } finally {
      this.#scene.remove(spin)
      spin.remove(object)
    }
  }

  /** Point the camera at the middle of it, far enough back that it is whole in frame at every angle. */
  #frame(spin: THREE.Group): void {
    spin.rotation.y = 0
    spin.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(spin)
    const middle = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    // it turns about the vertical, so what has to fit is its height against the
    // circle its footprint sweeps out, not its depth at this one angle
    const across = Math.hypot(size.x, size.z)
    const wanted = Math.max(size.y, across) * MARGIN
    const away = wanted / 2 / Math.tan(((LENS / 2) * Math.PI) / 180)

    // a little above the middle and looking slightly down, which is how a thing
    // in the hand is actually held
    this.#camera.position.set(middle.x, middle.y + wanted * 0.18, middle.z + away)
    this.#camera.lookAt(middle)
    this.#camera.updateProjectionMatrix()
  }
}
