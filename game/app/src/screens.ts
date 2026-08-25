import { SCREEN_ATTRIBUTE } from '@gb/furnish'
import type { InteriorBuild } from '@gb/scene'
import type { Interior } from '@gb/world'
import * as THREE from 'three'

/** How far off the glass the picture stands, in metres: enough to win the depth test, too little to see. */
const PROUD = 0.002

/** How long a source has to start playing before the town goes back to its own schedule. */
const PATIENCE = 8000

/**
 * What is playing on the televisions. A town writes its own schedule and every
 * set in it is arithmetic (`@gb/furnish`), which is what a world file can carry:
 * a video in one would be bytes in every copy of that city for ever. A player
 * who wants their own picture on the sets gives this a source of their own, and
 * it is theirs alone: it is kept with their settings in this browser, it is
 * never written into a city, and a source that will not play leaves the town's
 * own schedule running.
 *
 * The glass is found the way `@gb/furnish` publishes it, off the vertices that
 * carry the screen attribute, so a repacked television keeps its picture in the
 * right rectangle without a table here.
 */
export class Screens {
  #source: string
  #video: HTMLVideoElement | undefined
  #texture: THREE.VideoTexture | undefined
  #material: THREE.MeshBasicMaterial | undefined

  constructor(source: string) {
    this.#source = source
  }

  /**
   * Start the source. It answers whether it played, so the caller can say so;
   * nothing is drawn anywhere until it has. `video` is the element it plays in,
   * a fresh one unless the caller has one of their own.
   */
  async open(video: HTMLVideoElement = document.createElement('video')): Promise<boolean> {
    video.src = this.#source
    video.loop = true
    video.muted = true
    video.autoplay = true
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    this.#video = video
    let waited: ReturnType<typeof setTimeout> | undefined
    try {
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('canplay', () => resolve(), { once: true })
        video.addEventListener('error', () => reject(new Error(`${this.#source} would not play`)), { once: true })
        waited = setTimeout(() => reject(new Error(`${this.#source} did not answer`)), PATIENCE)
      })
      await video.play()
    } catch (cause) {
      console.warn(`nothing on the screens (${String(cause)}); the town's own schedule is playing`)
      this.close()
      return false
    } finally {
      clearTimeout(waited)
    }
    this.#texture = new THREE.VideoTexture(video)
    this.#texture.colorSpace = THREE.SRGBColorSpace
    this.#material = new THREE.MeshBasicMaterial({ map: this.#texture, toneMapped: false })
    return true
  }

  /**
   * Hang the picture on every television in a room that has just been built.
   * The panel is a child of the set, so it turns with it, goes with the room
   * when the room is let go, and costs one draw a set.
   */
  dress(built: InteriorBuild, interior: Interior): void {
    const material = this.#material
    if (!material) return
    for (const piece of interior.furniture) {
      if (piece.prop !== 'tv') continue
      const set = built.props.get(piece.id)
      const name = `screen:${piece.id}`
      // asked again on every entry, because the source may come up after the
      // room was built and a room let go is built again without it
      if (!set || set.getObjectByName(name)) continue
      const glass = glassOf(set)
      if (!glass) continue
      const { box, facing } = glass
      const picture = new THREE.Mesh(new THREE.PlaneGeometry(box.max.x - box.min.x, box.max.y - box.min.y), material)
      picture.name = name
      picture.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (facing > 0 ? box.max.z : box.min.z) + facing * PROUD)
      // a plane faces +z unturned, so one on the back of a set is turned round
      if (facing < 0) picture.rotation.y = Math.PI
      set.add(picture)
    }
  }

  /** Take the source down: the element, the texture and the material it was drawn with. */
  close(): void {
    this.#video?.pause()
    this.#video?.removeAttribute('src')
    this.#video = undefined
    this.#texture?.dispose()
    this.#texture = undefined
    this.#material?.dispose()
    this.#material = undefined
  }
}

/**
 * The rectangle a set's picture is drawn in, in the set's own metres, and which
 * way it looks. Every vertex of a screen carries `@gb/furnish`'s screen
 * attribute and no other vertex does, so the glass is exactly the vertices that
 * carry it, and the face it is on is the one further from the middle of the
 * piece: nothing on the seam says which way a set is drawn. A piece with no
 * glass in it takes the whole of its front instead.
 */
function glassOf(set: THREE.Object3D): { box: THREE.Box3; facing: 1 | -1 } | undefined {
  const glass = new THREE.Box3()
  const whole = new THREE.Box3()
  const at = new THREE.Vector3()
  set.updateWorldMatrix(true, true)
  const local = new THREE.Matrix4().copy(set.matrixWorld).invert()
  set.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const into = new THREE.Matrix4().multiplyMatrices(local, mesh.matrixWorld)
    const points = mesh.geometry.getAttribute('position')
    const screen = mesh.geometry.getAttribute(SCREEN_ATTRIBUTE)
    for (let vertex = 0; vertex < points.count; vertex++) {
      at.fromBufferAttribute(points, vertex).applyMatrix4(into)
      whole.expandByPoint(at)
      if (screen && lit(screen, vertex)) glass.expandByPoint(at)
    }
  })
  if (whole.isEmpty()) return undefined
  const middle = (whole.min.z + whole.max.z) / 2
  if (!glass.isEmpty()) return { box: glass, facing: (glass.min.z + glass.max.z) / 2 >= middle ? 1 : -1 }
  // no glass published: the picture takes the front of the piece, clear of the
  // stand it is drawn on
  const front = new THREE.Box3(new THREE.Vector3(whole.min.x, whole.min.y + (whole.max.y - whole.min.y) * 0.2, whole.max.z), whole.max)
  return { box: front, facing: 1 }
}

/** Whether a vertex is on a screen: any component of the attribute above zero, however wide the pack draws it. */
function lit(screen: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, vertex: number): boolean {
  for (let part = 0; part < screen.itemSize; part++) if (screen.getComponent(vertex, part) !== 0) return true
  return false
}
