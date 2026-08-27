import * as THREE from 'three'
import type { World } from '@gb/world'
import { City, CITY_TONES } from '../../blueprint/massing.ts'
import { Orbit } from '../../blueprint/orbit.ts'
import { paletteOf } from '../../blueprint/palette.ts'
import { planOf } from '../../blueprint/plan.ts'
import { Overlay } from './overlay.ts'

/** How wide the lens is. Narrow enough that a skyline stands up rather than splaying out. */
const FOV = 46

/** The nearest the camera draws, and how much further than the town it draws past it. */
const NEAR = 2
const BEYOND = 3

/** The clear middle of the view: what the header, the foot and the zone list take out of it, in pixels. */
const CHROME = { side: 274, band: 96 }

/** What the blueprint is while it is up. */
export interface Showing {
  dispose(): void
}

/**
 * The architecture on screen: a city you turn round and look at, with nothing
 * in it that a plan does not have. It is not the game and there is no walking
 * in it.
 *
 * It draws when something moves and not otherwise, because nothing in it
 * animates: a plan has no clock, no weather and nobody in it, so a frame drawn
 * a second time would be the same frame. The first one is drawn before this
 * answers, so whoever opened it is told the view is up once it is on the glass.
 */
export function open(input: { world: World; mount: HTMLElement; leave: () => void }): Showing {
  const plan = planOf(input.world)
  const palette = paletteOf(input.mount, CITY_TONES)
  const overlay = new Overlay({
    plan,
    handlers: {
      leave: () => input.leave(),
      fit: () => {
        orbit.frame(plan.ground, FOV, aspect(), room())
        draw()
      },
      read: (zoneId) => {
        city.light(zoneId)
        draw()
      },
    },
  })
  input.mount.append(overlay.root)

  const city = new City(plan, palette)
  const scene = new THREE.Scene()
  scene.add(city.root)

  // the panel's own grid shows through, so the city is drawn on the paper the
  // rest of the front door is drawn on
  const renderer = new THREE.WebGLRenderer({ canvas: overlay.glass, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, Math.hypot(plan.ground.w, plan.ground.d) * BEYOND)
  const orbit = new Orbit()

  const size = (): { width: number; height: number } => ({
    width: Math.max(overlay.root.clientWidth, 1),
    height: Math.max(overlay.root.clientHeight, 1),
  })
  const aspect = (): number => size().width / size().height
  // the town is framed into what the chrome leaves clear, so it lands in the
  // middle of the view rather than under the header or behind the zone list
  const room = (): { x: number; y: number } => {
    const { width, height } = size()
    return { x: Math.max(width - 2 * CHROME.side, width * 0.4) / width, y: Math.max(height - 2 * CHROME.band, height * 0.4) / height }
  }

  // drawn where the input arrives rather than on the next animation frame:
  // nothing here animates, so a frame is only ever owed to something the player
  // just did, and a view that waits for a frame that never comes is a view that
  // does not answer the pointer
  const spot = new THREE.Vector3()
  const draw = (): void => {
    const { width, height } = size()
    const eye = orbit.eye
    camera.position.set(eye.x, eye.y, eye.z)
    camera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z)
    camera.updateMatrixWorld()
    renderer.render(scene, camera)
    for (const anchor of overlay.anchors) {
      spot.set(anchor.x, anchor.y, anchor.z).project(camera)
      overlay.place(anchor.id, { x: (spot.x * 0.5 + 0.5) * width, y: (-spot.y * 0.5 + 0.5) * height, ahead: spot.z < 1 })
    }
  }

  const resize = (): void => {
    const { width, height } = size()
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    draw()
  }

  orbit.frame(plan.ground, FOV, aspect(), room())
  const watcher = new ResizeObserver(resize)
  watcher.observe(overlay.root)
  resize()

  const dragging = new Map<number, { x: number; y: number; pan: boolean }>()
  const glass = overlay.glass
  glass.addEventListener('pointerdown', (event) => {
    glass.setPointerCapture(event.pointerId)
    dragging.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.button !== 0 || event.shiftKey })
  })
  glass.addEventListener('pointermove', (event) => {
    const from = dragging.get(event.pointerId)
    if (!from) return
    const [dx, dy] = [event.clientX - from.x, event.clientY - from.y]
    dragging.set(event.pointerId, { ...from, x: event.clientX, y: event.clientY })
    if (from.pan) orbit.pan(dx, dy, size().height, FOV)
    else orbit.turn(dx, dy)
    draw()
  })
  const release = (event: PointerEvent): void => void dragging.delete(event.pointerId)
  glass.addEventListener('pointerup', release)
  glass.addEventListener('pointercancel', release)
  glass.addEventListener('contextmenu', (event) => event.preventDefault())
  glass.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      orbit.pull(Math.sign(event.deltaY))
      draw()
    },
    { passive: false },
  )

  const key = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    input.leave()
  }
  addEventListener('keydown', key)

  return {
    dispose: () => {
      removeEventListener('keydown', key)
      watcher.disconnect()
      city.dispose()
      renderer.dispose()
      overlay.dispose()
    },
  }
}
