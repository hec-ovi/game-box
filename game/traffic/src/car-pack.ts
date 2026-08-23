import { Box3, Mesh, Object3D, Vector3, type Material } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { CarBodies, CarBody, CarSpawn } from './bodies.ts'
import { CarPaint } from './car-paint.ts'
import { CarPackError } from './errors.ts'
import { CAR_PARTS, partName, type CarPart } from './pack-layout.ts'
import { CAR_MODELS, type CarModel } from './settings.ts'

/** How fast the front wheels swing to the angle the car is actually turning at. */
const STEER_EASE = 0.25
/** Wheels stop short of full lock, the way a car does. Radians. */
const MAX_STEER = 0.6

/** One car in the scene, with what it takes to roll its wheels. */
interface Driven {
  readonly object: Object3D
  readonly wheels: readonly Object3D[]
  readonly steered: readonly Object3D[]
  readonly radius: number
  readonly wheelBase: number
  /** Where it was when the wheels were last rolled. */
  x: number
  z: number
  heading: number
  spin: number
  steer: number
  /** A car put on the road this frame has not driven there: it has not rolled. */
  placed: boolean
}

/** A model as it comes out of the pack, measured once. */
interface Template {
  readonly node: Object3D
  readonly radius: number
  readonly wheelBase: number
}

/**
 * The cars, drawn. Loads `cars.glb`, hands `Traffic` an `Object3D` per car and
 * takes it back when the car retires, and rolls and steers the wheels from how
 * far each body has moved.
 *
 * Bodies are pooled: a retired car leaves the scene graph and waits for the
 * next car of the same model, so a night of driving clones seven cars a few
 * times over rather than one per spawn.
 */
export class CarPack implements CarBodies {
  readonly root: Object3D
  /** The one material every car in the pack wears. Hand it the hour and the lamps come on. */
  readonly paint: CarPaint
  readonly #templates: Map<CarModel, Template>
  readonly #free = new Map<CarModel, Object3D[]>()
  readonly #live = new Map<CarBody, Driven>()

  private constructor(root: Object3D, templates: Map<CarModel, Template>, paint: CarPaint) {
    this.root = root
    this.#templates = templates
    this.paint = paint
  }

  /** Fetches the pack and reads it. `url` is where the app serves `cars.glb` from. */
  static async load(url: string, root: Object3D): Promise<CarPack> {
    const response = await fetch(url)
    if (!response.ok) throw new CarPackError('unreadable-pack', url, `HTTP ${response.status}`)
    return CarPack.parse(await response.arrayBuffer(), root)
  }

  /** Reads a pack already in memory. */
  static async parse(bytes: ArrayBuffer, root: Object3D): Promise<CarPack> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const gltf = await loader.parseAsync(bytes, '').catch((cause: unknown) => {
      throw new CarPackError('unreadable-pack', 'cars.glb', String(cause))
    })
    const paint = new CarPaint()
    dress(gltf.scene, paint)
    const templates = new Map<CarModel, Template>()
    for (const model of CAR_MODELS) templates.set(model, measure(model, gltf.scene.getObjectByName(model)))
    return new CarPack(root, templates, paint)
  }

  /**
   * The hour of day, so the lamps know whether to be lit. Whoever owns the
   * clock calls this; the pack holds none. Two numbers, however many cars.
   */
  setTime(hours: number): void {
    this.paint.setTime(hours)
  }

  /** Bodies parked for reuse. Grows to the busiest street the player has seen, then stops. */
  get parked(): number {
    let total = 0
    for (const bodies of this.#free.values()) total += bodies.length
    return total
  }

  acquire(spawn: CarSpawn): CarBody {
    const template = this.#templates.get(spawn.model)!
    const object = this.#free.get(spawn.model)?.pop() ?? clone(spawn.model, template)
    this.root.add(object)
    this.#live.set(object, {
      object,
      wheels: wheelsOf(object, spawn.model, [CAR_PARTS.rear, CAR_PARTS.frontLeft, CAR_PARTS.frontRight]),
      steered: wheelsOf(object, spawn.model, [CAR_PARTS.frontLeft, CAR_PARTS.frontRight]),
      radius: template.radius,
      wheelBase: template.wheelBase,
      x: object.position.x,
      z: object.position.z,
      heading: object.rotation.y,
      spin: 0,
      steer: 0,
      placed: false,
    })
    return object
  }

  release(body: CarBody, spawn: CarSpawn): void {
    const driven = this.#live.get(body)
    if (!driven) return
    this.#live.delete(body)
    this.root.remove(driven.object)
    const parked = this.#free.get(spawn.model)
    if (parked) parked.push(driven.object)
    else this.#free.set(spawn.model, [driven.object])
  }

  /**
   * Rolls the wheels. Call it once a frame, after `Traffic.update`: every car
   * is turned by how far it moved, so the wheels match the road whatever the
   * frame rate, and the front pair points where the car is actually turning.
   */
  update(): void {
    for (const car of this.#live.values()) {
      const { position, rotation } = car.object
      if (car.placed) {
        const along = (position.x - car.x) * Math.sin(car.heading) + (position.z - car.z) * Math.cos(car.heading)
        const turned = wrap(rotation.y - car.heading)
        car.spin = (car.spin + along / car.radius) % (Math.PI * 2)
        const target = Math.abs(along) < 1e-4 ? 0 : clamp(Math.atan2(car.wheelBase * turned, Math.abs(along)))
        car.steer += (target - car.steer) * STEER_EASE
        for (const wheel of car.wheels) wheel.rotation.x = car.spin
        for (const wheel of car.steered) wheel.rotation.y = car.steer
      }
      car.placed = true
      car.x = position.x
      car.z = position.z
      car.heading = rotation.y
    }
  }
}

/**
 * Puts the pack's own material on every car and lets them into the shadow map.
 * The file ships flat glTF materials so any viewer can open it; what the game
 * draws is one `CarPaint` for the lot.
 */
function dress(scene: Object3D, paint: CarPaint): void {
  const spent = new Set<Material>()
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return
    for (const worn of Array.isArray(node.material) ? node.material : [node.material]) spent.add(worn)
    node.material = paint.material
    node.castShadow = true
    node.receiveShadow = true
  })
  for (const worn of spent) worn.dispose()
}

function clone(model: CarModel, template: Template): Object3D {
  const object = template.node.clone()
  // spin about the axle first, steer about the hub second, or the wheel turns
  // about the car's axis instead of its own
  for (const wheel of wheelsOf(object, model, [CAR_PARTS.frontLeft, CAR_PARTS.frontRight])) {
    wheel.rotation.order = 'YXZ'
  }
  return object
}

function wheelsOf(car: Object3D, model: CarModel, parts: readonly CarPart[]): Object3D[] {
  return parts.map((part) => car.getObjectByName(partName(model, part))!)
}

function measure(model: CarModel, node: Object3D | undefined): Template {
  if (!node) throw new CarPackError('incomplete-pack', model, 'the pack has no node for it')
  const front = node.getObjectByName(partName(model, CAR_PARTS.frontLeft))
  const rear = node.getObjectByName(partName(model, CAR_PARTS.rear))
  const rest = [CAR_PARTS.frontRight, CAR_PARTS.body].map((part) => node.getObjectByName(partName(model, part)))
  if (!front || !rear || rest.some((part) => !part)) {
    throw new CarPackError('incomplete-pack', model, 'a body and three wheel pivots is the whole car')
  }
  return {
    node,
    radius: new Box3().setFromObject(front).getSize(new Vector3()).y / 2,
    wheelBase: front.position.z - rear.position.z,
  }
}

function clamp(angle: number): number {
  return Math.max(-MAX_STEER, Math.min(MAX_STEER, angle))
}

/** An angle difference brought back into -pi..pi, so a car crossing north does not spin its wheels. */
function wrap(angle: number): number {
  return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
}
