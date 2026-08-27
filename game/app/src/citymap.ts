import type { MapMove, MapSpot, MapSurface, MapView } from '@gb/hud'
import type { World } from '@gb/world'
import * as THREE from 'three'
import { City, CITY_TONES } from './blueprint/massing.ts'
import { Orbit } from './blueprint/orbit.ts'
import { paletteOf } from './blueprint/palette.ts'
import { Pins, PIN_TONES, type Pin, type PinTone } from './blueprint/pins.ts'
import { planOf, type Massing, type Plan } from './blueprint/plan.ts'

/** How wide the lens is. Narrow enough that a skyline stands up rather than splaying out. */
const FOV = 46

/** The nearest the camera draws, and how much further than the town it draws past it. */
const NEAR = 2
const BEYOND = 3

/** How much of the glass the town is framed into, so it lands clear of the tools in the corner. */
const ROOM = { x: 0.86, y: 0.82 }

/** How far one press of an arrow key pushes the middle of the view, in pixels of drag. */
const KEY_PAN = 90

/** How far over a thing its label floats, in metres: clear of what it stands on. */
const LIFT = { mark: 14, station: 20 }

/** Which tone a pin is drawn in, by what it stands for. */
const TONE: Record<string, PinTone> = {
  you: '--gb-accent',
  goal: '--gb-quest-side',
  offer: '--gb-quest-side',
  home: '--gb-accent-lit',
  station: '--gb-ink',
  district: '--gb-accent-dim',
  place: '--gb-accent-dim',
}

/** A point on the city in metres, which is what the camera is put onto. */
export interface Spot {
  readonly x: number
  readonly z: number
}

/**
 * The city as its architecture, drawn on the glass the interface holds in its
 * map: every building a box at its real footprint and height, the streets the
 * ground between them, the parts of town as the shapes their blocks make. No
 * textures, no sky, no hour, nobody walking. It is the same drawing the front
 * door shows before a city is written, standing in the game.
 *
 * It draws when something is done to it and not otherwise. Nothing in it moves
 * on its own, and the game behind it is standing still while the window is up,
 * so a frame drawn a second time would be the same frame.
 *
 * The interface owns the glass, the labels over it and the panels either side;
 * this owns the renderer, the camera and where everything landed.
 */
export class CityMap {
  #world: World
  #surface: MapSurface
  #onRead: (targetId: string | null) => void
  #plan: Plan | undefined
  #scene: THREE.Scene | undefined
  #city: City | undefined
  #pins: Pins | undefined
  #renderer: THREE.WebGLRenderer | undefined
  #camera: THREE.PerspectiveCamera | undefined
  #orbit = new Orbit()
  #anchors: Array<{ id: string; x: number; y: number; z: number }> = []
  #watcher: ResizeObserver | undefined
  #survey: MapView | undefined
  #surveyed = ''
  #open = false
  #dragged = 0

  constructor(input: { world: World; surface: MapSurface; onRead: (targetId: string | null) => void }) {
    this.#world = input.world
    this.#surface = input.surface
    this.#onRead = input.onRead
    this.#bind(input.surface.canvas)
  }

  /** The map face is up, or it is not. The city is built on the first open and kept after that. */
  set open(on: boolean) {
    if (on === this.#open) return
    this.#open = on
    if (!on) {
      this.#surface.drawing = false
      return
    }
    // the glass goes on the page first, so the renderer is sized to a canvas
    // the browser has laid out rather than to a hidden one
    this.#surface.drawing = true
    const ready = this.#build()
    this.#surface.drawing = ready
    if (!ready) return
    this.#watch()
    this.draw()
  }

  /** The same survey the interface was pushed: what stands on the city, and what has a name. */
  survey(view: MapView): void {
    this.#survey = view
    const key = keyOf(view)
    if (key === this.#surveyed) return
    this.#surveyed = key
    this.#pin()
    if (this.#open) this.draw()
  }

  /** The camera, moved by a tool over the glass or by its key. */
  move(move: MapMove, you: Spot | undefined): void {
    const plan = this.#plan
    if (!plan) return
    if (move === 'in') this.#orbit.pull(-1)
    else if (move === 'out') this.#orbit.pull(1)
    else if (move === 'fit') this.#orbit.frame(plan.ground, FOV, this.#aspect(), ROOM)
    else if (move === 'you') {
      if (you) this.#orbit.look(you)
    } else {
      const [dx, dy] = PUSH[move]
      this.#orbit.pan(dx * KEY_PAN, dy * KEY_PAN, this.#size().height, FOV)
    }
    this.draw()
  }

  /** Put the camera onto one spot on the city, and hold whichever part of town it is in lit. */
  look(at: Spot | undefined, districtId: string | undefined): void {
    if (at) this.#orbit.look(at)
    this.#city?.light(districtId)
    this.draw()
  }

  /** Draw one frame, and say where everything landed so the labels follow it. */
  draw(): void {
    const renderer = this.#renderer
    const camera = this.#camera
    const scene = this.#scene
    if (!renderer || !camera || !scene || !this.#open) return
    const { width, height } = this.#size()
    const eye = this.#orbit.eye
    camera.position.set(eye.x, eye.y, eye.z)
    camera.lookAt(this.#orbit.target.x, this.#orbit.target.y, this.#orbit.target.z)
    camera.updateMatrixWorld()
    renderer.render(scene, camera)

    const at = new THREE.Vector3()
    const spots: MapSpot[] = this.#anchors.map((anchor) => {
      at.set(anchor.x, anchor.y, anchor.z).project(camera)
      return { id: anchor.id, x: (at.x * 0.5 + 0.5) * width, y: (-at.y * 0.5 + 0.5) * height, ahead: at.z < 1 }
    })
    this.#surface.place({ zoom: this.#orbit.zoom, spots })
  }

  dispose(): void {
    this.#watcher?.disconnect()
    this.#watcher = undefined
    this.#pins?.dispose()
    this.#city?.dispose()
    this.#renderer?.dispose()
    this.#renderer = undefined
    this.#scene = undefined
  }

  /**
   * The city itself, built once and kept. A twenty block town is a few hundred
   * draw calls and no textures at all, so building it again on every open would
   * be a wait for nothing.
   *
   * Where there is no drawing to be had, on a page with no palette on it or a
   * browser that will not give a context, the map is its two columns of reading
   * and no glass, rather than a black rectangle nobody can use.
   */
  #build(): boolean {
    if (this.#scene) return true
    try {
      const palette = paletteOf(this.#surface.canvas, [...CITY_TONES, ...PIN_TONES])
      const plan = planOf(this.#world)
      const city = new City(plan, palette)
      const pins = new Pins(palette)
      const scene = new THREE.Scene()
      scene.add(city.root, pins.root)
      const renderer = new THREE.WebGLRenderer({ canvas: this.#surface.canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))
      this.#plan = plan
      this.#city = city
      this.#pins = pins
      this.#scene = scene
      this.#renderer = renderer
      this.#camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, Math.hypot(plan.ground.w, plan.ground.d) * BEYOND)
      this.#orbit.frame(plan.ground, FOV, this.#aspect(), ROOM)
      this.#pin()
      this.#resize()
      return true
    } catch (cause) {
      console.warn('no drawing of the city', cause)
      return false
    }
  }

  /** Where every named thing stands, in metres, and how high its label floats over it. */
  #pin(): void {
    const plan = this.#plan
    const view = this.#survey
    if (!plan || !view) return
    const cell = this.#world.cellSize
    const pins: Pin[] = []
    for (const mark of view.marks ?? []) {
      const x = mark.x * cell
      const z = mark.y * cell
      pins.push({ id: mark.id, x, z, top: heightAt(plan, x, z) + LIFT.mark, tone: toneOf(mark.kind, mark.line) })
    }
    for (const station of view.stations ?? []) {
      pins.push({ id: station.id, x: station.x * cell, z: station.y * cell, top: LIFT.station, tone: TONE.station! })
    }
    // the buildings the survey asked to be named stand their own label over
    // their roof, so a place already walked into is findable on the drawing
    for (const plot of view.plots) {
      if (!plot.named || !plot.label) continue
      const x = (plot.rect.x + plot.rect.w / 2) * cell
      const z = (plot.rect.y + plot.rect.h / 2) * cell
      pins.push({ id: plot.id, x, z, top: heightAt(plan, x, z) + LIFT.mark, tone: TONE.place! })
    }
    // a stem stands only under what the map is pointing the player at: the
    // buildings with names on them are the drawing itself, and a stem on every
    // one of them is a thicket
    this.#pins?.set(pins.filter((pin) => pin.tone !== TONE.place))
    this.#anchors = [
      ...pins.map((pin) => ({ id: pin.id, x: pin.x, y: pin.top, z: pin.z })),
      // a part of town writes its name over its roofs, where the blueprint already floats it
      ...plan.zones.map((zone) => ({ id: zone.id, x: zone.heart.x, y: zone.top, z: zone.heart.z })),
    ]
  }

  #watch(): void {
    if (this.#watcher) return
    this.#watcher = new ResizeObserver(() => this.#resize())
    this.#watcher.observe(this.#surface.canvas)
  }

  #resize(): void {
    const camera = this.#camera
    if (!this.#renderer || !camera) return
    const { width, height } = this.#size()
    this.#renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    this.draw()
  }

  #size(): { width: number; height: number } {
    const canvas = this.#surface.canvas
    return { width: Math.max(canvas.clientWidth, 1), height: Math.max(canvas.clientHeight, 1) }
  }

  #aspect(): number {
    const { width, height } = this.#size()
    return width / height
  }

  /** Dragging turns the city, the other button pushes it about, the wheel comes in and out. */
  #bind(glass: HTMLCanvasElement): void {
    const dragging = new Map<number, { x: number; y: number; pan: boolean }>()
    glass.addEventListener('pointerdown', (event) => {
      glass.setPointerCapture(event.pointerId)
      this.#dragged = 0
      dragging.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.button !== 0 || event.shiftKey })
    })
    glass.addEventListener('pointermove', (event) => {
      const from = dragging.get(event.pointerId)
      if (!from) return
      const [dx, dy] = [event.clientX - from.x, event.clientY - from.y]
      this.#dragged += Math.abs(dx) + Math.abs(dy)
      dragging.set(event.pointerId, { ...from, x: event.clientX, y: event.clientY })
      if (from.pan) this.#orbit.pan(dx, dy, this.#size().height, FOV)
      else this.#orbit.turn(dx, dy)
      this.draw()
    })
    const release = (event: PointerEvent): void => void dragging.delete(event.pointerId)
    glass.addEventListener('pointerup', release)
    glass.addEventListener('pointercancel', release)
    glass.addEventListener('contextmenu', (event) => event.preventDefault())
    // a click on the city itself, rather than on a label, is the player putting
    // down whatever they were reading
    glass.addEventListener('click', () => {
      if (this.#dragged < 4) this.#onRead(null)
    })
    glass.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        this.#orbit.pull(Math.sign(event.deltaY))
        this.draw()
      },
      { passive: false },
    )
  }
}

/** Which way an arrow key pushes the middle of the view. */
const PUSH: Record<'left' | 'right' | 'up' | 'down', readonly [number, number]> = {
  left: [1, 0],
  right: [-1, 0],
  up: [0, 1],
  down: [0, -1],
}

function toneOf(kind: string, line: string | undefined): PinTone {
  if ((kind === 'goal' || kind === 'offer') && line === 'main') return '--gb-quest-main'
  return TONE[kind] ?? '--gb-accent'
}

/** How tall whatever stands on that spot is, so a label floats clear of its roof rather than inside it. */
function heightAt(plan: Plan, x: number, z: number): number {
  let tallest = 0
  for (const building of plan.buildings) {
    if (covers(building, x, z)) tallest = Math.max(tallest, building.height)
  }
  return tallest
}

function covers(building: Massing, x: number, z: number): boolean {
  return x >= building.x && x <= building.x + building.w && z >= building.z && z <= building.z + building.d
}

/** Everything on the survey that changes where a label stands. */
function keyOf(view: MapView): string {
  const marks = (view.marks ?? []).map((mark) => `${mark.id}:${mark.kind}:${mark.line ?? ''}:${mark.x},${mark.y}`).join('|')
  const stations = (view.stations ?? []).map((station) => station.id).join('|')
  const named = view.plots.filter((plot) => plot.named).map((plot) => plot.id).join('|')
  return `${marks}#${stations}#${named}`
}
