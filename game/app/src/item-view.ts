import type { Dressing } from '@gb/scene'
import type { Item } from '@gb/world'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'

/** Air round the thing in frame, as a share of its own size. */
const MARGIN = 1.3

/** A narrow lens, so a thing close to the camera is not bent out towards it. */
const LENS = 30

/** How far the eye sits above the middle of it, as a share of the frame: looking slightly down, the way a thing is held. */
const ABOVE = 0.18

/**
 * The thing the player has open in the inventory, drawn live into the canvas
 * the interface holds.
 *
 * It is the object the city would put on a shelf, from the same dressing and
 * the same art, turning under the player's hand. A second renderer is what pays
 * for that, and it is affordable because it only ever draws while the inventory
 * is open, which is exactly when the game behind it is paused: one small canvas,
 * one object, two lights, no shadows.
 *
 * Made on the first thing the player opens rather than with the game, so a
 * playthrough that never opens the inventory never makes a context for it.
 */
export class ItemView {
  #dressing: Dressing
  #canvas: HTMLCanvasElement
  #scene = new THREE.Scene()
  #camera = new THREE.PerspectiveCamera(LENS, 1, 0.01, 100)
  #spin = new THREE.Group()
  #renderer: WebGPURenderer | undefined
  #starting: Promise<WebGPURenderer | undefined> | undefined
  #showing: string | undefined
  #built = new Map<string, THREE.Object3D>()
  #reach = 1
  #dead = false

  constructor(input: { dressing: Dressing; canvas: HTMLCanvasElement }) {
    this.#dressing = input.dressing
    this.#canvas = input.canvas
    // lit from the front and above with a fill under, the same for everything,
    // so a thing is not dark because of the hour it was picked up
    const key = new THREE.DirectionalLight(0xfff4e2, 2.6)
    key.position.set(0.7, 1.4, 1.6)
    const fill = new THREE.DirectionalLight(0xbfd8ea, 0.9)
    fill.position.set(-1, -0.3, 1)
    this.#scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.5), this.#spin)
  }

  /** Put a thing in the frame and draw it. Nothing happens for a thing the dressing cannot draw. */
  async show(item: Item): Promise<void> {
    if (this.#dead) return
    this.#showing = item.id
    const object = this.#object(item)
    if (!object) return
    this.#spin.clear()
    this.#spin.add(object)
    this.#frame(object)
    await this.#draw()
  }

  /** Where the player has turned it to, in radians. Drawn again on the spot: they are dragging it. */
  turn(yaw: number, pitch: number): void {
    this.#spin.rotation.set(pitch, yaw, 0)
    void this.#draw()
  }

  /** Nothing is open: the canvas stops being drawn and the thing lets its geometry go. */
  close(): void {
    this.#showing = undefined
    this.#spin.clear()
  }

  dispose(): void {
    this.#dead = true
    this.close()
    for (const object of this.#built.values()) {
      object.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
    }
    this.#built.clear()
    this.#renderer?.dispose()
    this.#renderer = undefined
  }

  /** The thing itself, built once and kept: opening it again is not a second build. */
  #object(item: Item): THREE.Object3D | undefined {
    const already = this.#built.get(item.id)
    if (already) return already
    try {
      const made = this.#dressing.pickup(item)
      this.#built.set(item.id, made)
      return made
    } catch (cause) {
      console.warn(`nothing to draw for ${item.id}`, cause)
      return undefined
    }
  }

  /** Point the camera at the middle of it, far enough back that it is whole in frame at every angle. */
  #frame(object: THREE.Object3D): void {
    this.#spin.rotation.set(0, 0, 0)
    this.#spin.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const middle = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    // it turns about every axis, so what has to fit is the sphere round it and
    // not its depth at the one angle it starts on
    this.#reach = Math.max(0.01, Math.hypot(size.x, size.y, size.z) / 2) * MARGIN
    // the object turns about the group's origin, so it is moved onto it
    object.position.sub(middle)
    const away = this.#reach / Math.tan(((LENS / 2) * Math.PI) / 180)
    this.#camera.position.set(0, this.#reach * ABOVE, away)
    this.#camera.lookAt(0, 0, 0)
    this.#camera.updateProjectionMatrix()
  }

  async #draw(): Promise<void> {
    const renderer = await this.#start()
    if (!renderer || this.#dead || !this.#showing) return
    const width = Math.max(1, this.#canvas.clientWidth)
    const height = Math.max(1, this.#canvas.clientHeight)
    renderer.setSize(width, height, false)
    this.#camera.aspect = width / height
    this.#camera.updateProjectionMatrix()
    await renderer.renderAsync(this.#scene, this.#camera)
  }

  /** The renderer, made on the first thing opened and never twice, even while the first is still starting. */
  async #start(): Promise<WebGPURenderer | undefined> {
    if (this.#renderer) return this.#renderer
    this.#starting ??= (async () => {
      try {
        const renderer = new WebGPURenderer({ canvas: this.#canvas, alpha: true, antialias: true })
        await renderer.init()
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))
        renderer.setClearColor(0x000000, 0)
        renderer.toneMapping = THREE.AgXToneMapping
        this.#renderer = renderer
        return renderer
      } catch (cause) {
        // the panel keeps the thing's icon; nothing else in the game is affected
        console.warn('no view of the thing in hand', cause)
        return undefined
      }
    })()
    return this.#starting
  }
}
