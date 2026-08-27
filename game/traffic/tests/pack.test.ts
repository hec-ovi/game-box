import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Box3, Matrix3, Mesh, Object3D, Triangle, Vector3 } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { CAR_SURFACES } from '../src/pack-layout.ts'
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

/** Every mesh of a car, in the order the pack hangs them. */
function meshesOf(car: Object3D): Mesh[] {
  const found: Mesh[] = []
  car.traverse((node) => {
    if (node instanceof Mesh) found.push(node)
  })
  return found
}

/**
 * Where a car's lamps are, in world space. The pack carries no material names
 * any more: a vertex says which surface it is and what colour, so a near-white
 * lamp is a head lamp and a red one is a tail lamp. The police car's roof
 * beacons are neither and are left out of both.
 */
function lampsOf(car: Object3D): { head: Vector3; tail: Vector3 } {
  car.updateMatrixWorld(true)
  const head = new Vector3()
  const tail = new Vector3()
  let heads = 0
  let tails = 0
  const at = new Vector3()
  for (const mesh of meshesOf(car)) {
    const colour = mesh.geometry.getAttribute('color')
    const position = mesh.geometry.getAttribute('position')
    for (let i = 0; i < colour.count; i++) {
      if (Math.round(colour.getW(i) * 255) !== CAR_SURFACES.lamp) continue
      at.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
      if (colour.getX(i) > 0.8) {
        head.add(at)
        heads++
      } else if (colour.getX(i) > colour.getY(i) * 2) {
        tail.add(at)
        tails++
      }
    }
  }
  if (!heads || !tails) throw new Error(`${car.name}: ${heads} head lamp and ${tails} tail lamp vertices`)
  return { head: head.divideScalar(heads), tail: tail.divideScalar(tails) }
}

/**
 * The share of vertices whose normal is not the flat normal of their own
 * triangle. Flat art scores near zero; smoothed panels score a third and up.
 * The pack is quantized, so both are read in world space where they agree.
 */
function shadedSmoothly(mesh: Mesh): number {
  mesh.updateWorldMatrix(true, false)
  const toWorld = mesh.matrixWorld
  const forNormals = new Matrix3().getNormalMatrix(toWorld)
  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.index
  const count = index ? index.count : position.count
  const face = new Triangle()
  const flat = new Vector3()
  const vertex = new Vector3()
  let rounded = 0
  for (let i = 0; i < count; i += 3) {
    const abc = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k))
    face.set(
      new Vector3().fromBufferAttribute(position, abc[0]!).applyMatrix4(toWorld),
      new Vector3().fromBufferAttribute(position, abc[1]!).applyMatrix4(toWorld),
      new Vector3().fromBufferAttribute(position, abc[2]!).applyMatrix4(toWorld),
    )
    face.getNormal(flat)
    for (const v of abc) {
      vertex.fromBufferAttribute(normal, v!).applyMatrix3(forNormals).normalize()
      if (vertex.dot(flat) < Math.cos(0.09)) rounded++ // more than five degrees off flat
    }
  }
  return rounded / count
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

      // every car is scaled as large as it fits the footprint the simulation
      // keeps clear, 4.5 m by 1.8 m, so whichever of the two runs out first binds
      expect(size.x, `${model} width`).toBeLessThanOrEqual(CAR_FOOTPRINT.width + 0.01)
      expect(size.z, `${model} length`).toBeLessThanOrEqual(CAR_FOOTPRINT.length + 0.01)
      expect(
        Math.max(size.x / CAR_FOOTPRINT.width, size.z / CAR_FOOTPRINT.length),
        `${model} fills its slot`,
      ).toBeCloseTo(1, 2)
      expect(size.z, `${model} length`).toBeGreaterThan(3.5)
      expect(size.y, `${model} height`).toBeGreaterThan(0.9)
      expect(boundsOf(car as Object3D).min.y, `${model} tyres`).toBeCloseTo(0, 2)
      pack.release(car, { id: `car_${model}`, model })
    }
    expect(pack.parked).toBe(CAR_MODELS.length)
  })

  it('points its nose down +Z, which is what heading means', () => {
    for (const model of CAR_MODELS) {
      const car = pack.acquire({ id: 'car_nose', model }) as Object3D

      const still = lampsOf(car)
      expect(still.head.z, `${model} head lamps`).toBeGreaterThan(1)
      expect(still.tail.z, `${model} tail lamps`).toBeLessThan(0)
      expect(still.head.z - still.tail.z, `${model} lamps at opposite ends`).toBeGreaterThan(2)

      // heading is rotation.y, so a car heading east has its lamps to the east.
      // Their middle is only as centred as the model is: a fitted car's lamps
      // are a few centimetres off its centreline, which is a tenth of its width.
      car.rotation.y = Math.PI / 2
      const east = lampsOf(car).head
      expect(east.x, `${model} facing east`).toBeGreaterThan(1)
      expect(Math.abs(east.z), `${model} facing east`).toBeLessThan(0.2)

      car.rotation.y = 0
      pack.release(car, { id: 'car_nose', model })
    }
  })

  it('carries normals that round the panels off instead of shading every face flat', () => {
    for (const model of CAR_MODELS) {
      const car = pack.acquire({ id: 'car_shade', model }) as Object3D
      for (const mesh of meshesOf(car)) {
        expect(mesh.geometry.getAttribute('normal'), `${model} normals`).toBeDefined()
      }
      // a flat-shaded pack scores zero here: every vertex normal is its own face's
      const body = meshesOf(car)[0]!
      expect(shadedSmoothly(body), `${model} smooth share`).toBeGreaterThan(0.25)
      pack.release(car, { id: 'car_shade', model })
    }
  })

  it('is one material and four draws a car, with every surface on the vertices', () => {
    const surfaces = new Set<number>()
    for (const model of CAR_MODELS) {
      const car = pack.acquire({ id: 'car_draws', model }) as Object3D
      const meshes = meshesOf(car)
      expect(meshes.length, `${model} draws`).toBe(4) // a body and three wheels
      for (const mesh of meshes) {
        expect(mesh.material, `${model} shares the pack material`).toBe(pack.paint.material)
        const colour = mesh.geometry.getAttribute('color')
        expect(colour.itemSize, `${model} vertex colour`).toBe(4)
        for (let i = 0; i < colour.count; i++) surfaces.add(Math.round(colour.getW(i) * 255))
      }
      pack.release(car, { id: 'car_draws', model })
    }
    expect([...surfaces].sort()).toEqual(Object.values(CAR_SURFACES).sort())
  })

  it('is closed underneath, so the wheel arches are not holes', () => {
    for (const model of CAR_MODELS) {
      const car = pack.acquire({ id: 'car_under', model }) as Object3D
      const body = meshesOf(car)[0]!
      // the shell's own sill stops 11 to 22 cm up; what is under the car reaches the road
      expect(boundsOf(body).min.y, `${model} underbody`).toBeLessThan(0.05)
      pack.release(car, { id: 'car_under', model })
    }
  })

  it('lights its lamps after dark and puts them out by day', () => {
    pack.setTime(13)
    expect(pack.paint.lamps).toBe(0)
    pack.setTime(22)
    expect(pack.paint.lamps).toBe(1)
    pack.setTime(4)
    expect(pack.paint.lamps).toBe(1)
    pack.setTime(12)
    expect(pack.paint.lamps).toBe(0)
  })

  it('rolls the wheels of every model it carries, and steers the front pair', () => {
    for (const model of CAR_MODELS) {
      const car = pack.acquire({ id: 'car_roll', model }) as Object3D
      const wheels = [CAR_PARTS.rear, CAR_PARTS.frontLeft, CAR_PARTS.frontRight].map(
        (part) => car.getObjectByName(partName(model, part))!,
      )
      const radius = boundsOf(wheels[1]!).getSize(new Vector3()).y / 2
      expect(radius, `${model} wheel radius`).toBeGreaterThan(0.2)

      // a car put on the road has not driven there
      car.position.z = 40
      pack.update()
      for (const wheel of wheels) expect(wheel.rotation.x, `${model} placed`).toBeCloseTo(0, 6)

      // two metres of road is two metres of tyre, kept inside one turn
      car.position.z += 2
      pack.update()
      for (const wheel of wheels) expect(wheel.rotation.x, `${model} rolled`).toBeCloseTo((2 / radius) % (Math.PI * 2), 3)

      // a metre forward while turning east: the front wheels point into the turn
      car.position.z += 1
      car.rotation.y = 0.3
      pack.update()
      expect(wheels[1]!.rotation.y, `${model} steers`).toBeGreaterThan(0)
      expect(wheels[2]!.rotation.y, `${model} steers together`).toBe(wheels[1]!.rotation.y)
      expect(wheels[0]!.rotation.y, `${model} rear axle does not steer`).toBeCloseTo(0, 6)

      car.position.set(0, 0, 0)
      car.rotation.y = 0
      pack.release(car, { id: 'car_roll', model })
    }
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
