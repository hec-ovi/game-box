import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Box3, Mesh, Object3D, Vector3, type Material } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { CARS_FILE, CAR_FOOTPRINT, CAR_MODELS, CAR_PARTS, CarPack, partName, Traffic, type CarModel } from '../src/index.ts'
import { lattice } from './city.ts'

/** The pack tools/build-cars.ts writes. Override the folder with GB_ASSETS_DIST. */
const PACK = join(process.env['GB_ASSETS_DIST'] ?? resolve(import.meta.dirname, '../../../assets/dist'), CARS_FILE)
const built = existsSync(PACK)

// three reaches for browser globals while loading a glb; the geometry does not need them
const globals = globalThis as Record<string, unknown>
globals['self'] ??= globalThis

const root = new Object3D()
let pack: CarPack

/** World bounds of anything hanging in the scene. */
const boundsOf = (object: Object3D): Box3 => new Box3().setFromObject(object)

/** The part of a car painted with one of the pack's materials, headlights included. */
function partWearing(car: Object3D, material: string): Object3D {
  let match: Object3D | undefined
  car.traverse((node) => {
    if (node instanceof Mesh && (node.material as Material).name === material) match = node
  })
  if (!match) throw new Error(`no ${material} on ${car.name}`)
  return match
}

describe.skipIf(!built)('the shipped cars', () => {
  beforeAll(async () => {
    const bytes = readFileSync(PACK)
    pack = await CarPack.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), root)
  })

  it('has every model at the size of a real car, sitting on the road', () => {
    for (const model of CAR_MODELS) {
      const car = pack.acquire({ id: `car_${model}`, model })
      const size = boundsOf(car as Object3D).getSize(new Vector3())

      // the pack's cars are stylish rather than exact, so each is scaled to fit
      // the footprint the simulation keeps clear: 1.8 m across, never over 4.5 long
      expect(size.x, `${model} width`).toBeCloseTo(CAR_FOOTPRINT.width, 2)
      expect(size.z, `${model} length`).toBeLessThanOrEqual(CAR_FOOTPRINT.length)
      expect(size.z, `${model} length`).toBeGreaterThan(3.5)
      expect(size.y, `${model} height`).toBeGreaterThan(1)
      expect(boundsOf(car as Object3D).min.y, `${model} tyres`).toBeCloseTo(0, 2)
      pack.release(car, { id: `car_${model}`, model })
    }
    expect(pack.parked).toBe(CAR_MODELS.length)
  })

  it('points its nose down +Z, which is what heading means', () => {
    for (const model of CAR_MODELS) {
      const car = pack.acquire({ id: 'car_nose', model }) as Object3D
      const lamps = () => boundsOf(partWearing(car, 'Headlights')).getCenter(new Vector3())

      car.updateMatrixWorld(true)
      expect(lamps().z, `${model} headlights`).toBeGreaterThan(1)

      // heading is rotation.y, so a car heading east has its lamps to the east
      car.rotation.y = Math.PI / 2
      car.updateMatrixWorld(true)
      const east = lamps()
      expect(east.x, `${model} facing east`).toBeGreaterThan(1)
      expect(east.z, `${model} facing east`).toBeCloseTo(0, 1)

      car.rotation.y = 0
      pack.release(car, { id: 'car_nose', model })
    }
  })

  it('rolls its wheels by how far the car moved, and steers the front pair', () => {
    const model: CarModel = 'NormalCar1'
    const car = pack.acquire({ id: 'car_roll', model }) as Object3D
    const wheels = [CAR_PARTS.rear, CAR_PARTS.frontLeft, CAR_PARTS.frontRight].map(
      (part) => car.getObjectByName(partName(model, part))!,
    )
    const radius = boundsOf(wheels[1]!).getSize(new Vector3()).y / 2

    // a car put on the road has not driven there
    car.position.z = 40
    pack.update()
    for (const wheel of wheels) expect(wheel.rotation.x).toBeCloseTo(0, 6)

    // two metres of road is two metres of tyre, kept inside one turn
    car.position.z += 2
    pack.update()
    for (const wheel of wheels) expect(wheel.rotation.x).toBeCloseTo((2 / radius) % (Math.PI * 2), 3)

    // a metre forward while turning east: the front wheels point into the turn
    car.position.z += 1
    car.rotation.y = 0.3
    pack.update()
    expect(wheels[1]!.rotation.y).toBeGreaterThan(0)
    expect(wheels[2]!.rotation.y).toBe(wheels[1]!.rotation.y)
    expect(wheels[0]!.rotation.y, 'the rear axle does not steer').toBeCloseTo(0, 6)
    pack.release(car, { id: 'car_roll', model })
  })

  it('drives a city with the real cars in it', async () => {
    const scene = new Object3D()
    const bytes = readFileSync(PACK)
    const bodies = await CarPack.parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      scene,
    )
    const made = Traffic.fromWorld(lattice({ across: 4, down: 4, span: 13 }), { maxCars: 12, bodies })
    if (!made.ok) throw new Error(JSON.stringify(made.error))
    const focus = { x: 40, z: 40 }
    made.value.populate(focus)
    expect(scene.children.length).toBe(made.value.count)

    for (let frame = 0; frame < 600; frame++) {
      made.value.update(1 / 60, focus)
      bodies.update()
    }
    for (const car of made.value.cars()) {
      const object = scene.children.find((child) => child.position.x === car.x && child.position.z === car.z)
      expect(object, `no body at ${car.id}`).toBeDefined()
      // the roadway is 6 m wide: a car in it never sticks out of its own lane
      expect(boundsOf(object!).getSize(new Vector3()).y).toBeGreaterThan(1)
    }
    const spun = scene.children.some(
      (child) => Math.abs(child.getObjectByName(partName(child.name as CarModel, CAR_PARTS.rear))!.rotation.x) > 1,
    )
    expect(spun, 'nothing rolled').toBe(true)
  })
})
