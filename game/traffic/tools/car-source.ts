import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Box3, Group, Matrix4, Mesh, Vector3, type Material } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { CAR_FOOTPRINT, CAR_PARTS, partName, type CarPart } from '../src/pack-layout.ts'
import type { CarModel } from '../src/settings.ts'
import { bakeSurfaces, crease, packMaterial } from './car-shading.ts'
import { underbody } from './car-underbody.ts'

/**
 * Turns one car of the Quaternius pack (an .obj and its .mtl) into the node the
 * game drives: sized to the footprint the simulation reserves, sitting on the
 * road at y = 0, centred on its own middle, nose down +Z, each wheel on a pivot
 * at its axle so it can be spun and steered, shaded, and closed underneath.
 */

/** Which source object is which, by the names Quaternius gave them. */
const PART_OF: ReadonlyArray<readonly [string, CarPart]> = [
  ['FrontLeftWheel', CAR_PARTS.frontLeft],
  ['FrontRightWheel', CAR_PARTS.frontRight],
  ['BackWheels', CAR_PARTS.rear],
]

export interface CarBuild {
  readonly node: Group
  /** What the source model was multiplied by to reach this size. */
  readonly scale: number
  readonly size: { readonly length: number; readonly width: number; readonly height: number }
  readonly wheelRadius: number
  readonly wheelBase: number
}

export function buildCar(model: CarModel, directory: string): CarBuild {
  const source = load(model, directory)
  const meshes = source.children.filter((child): child is Mesh => child instanceof Mesh)
  if (meshes.length !== PART_OF.length + 1) {
    throw new Error(`${model}: expected a body and ${PART_OF.length} wheels, found ${meshes.length} objects`)
  }

  const whole = new Box3()
  for (const mesh of meshes) whole.expandByObject(mesh)
  const size = whole.getSize(new Vector3())
  // one factor for both axes, so the car keeps its own proportions and still
  // fits the 4.5 m by 1.8 m slot the simulation keeps clear around it
  const scale = Math.min(CAR_FOOTPRINT.length / size.z, CAR_FOOTPRINT.width / size.x)
  const centre = whole.getCenter(new Vector3())
  const place = new Matrix4()
    .makeTranslation(-centre.x * scale, -whole.min.y * scale, -centre.z * scale)
    .multiply(new Matrix4().makeScale(scale, scale, scale))
  for (const mesh of meshes) mesh.geometry.applyMatrix4(place)

  const body = meshes.find((mesh) => !PART_OF.some(([name]) => mesh.name.includes(name)))
  if (!body) throw new Error(`${model}: no body mesh`)
  facesForward(model, body)

  const material = packMaterial()
  const node = new Group()
  node.name = model
  const wheels = new Map<CarPart, Box3>()
  for (const mesh of meshes) {
    crease(mesh.geometry)
    bakeSurfaces(mesh, material)
    mesh.geometry.computeBoundingBox()
    const part = PART_OF.find(([source]) => mesh.name.includes(source))
    if (!part) {
      mesh.name = partName(model, CAR_PARTS.body)
      node.add(mesh)
      continue
    }
    wheels.set(part[1], mesh.geometry.boundingBox!.clone())
    pivot(mesh, partName(model, part[1]), node)
  }
  for (const [, part] of PART_OF) {
    if (!wheels.has(part)) throw new Error(`${model}: the source has no ${part}`)
  }

  const front = wheels.get(CAR_PARTS.frontLeft)!
  const rear = wheels.get(CAR_PARTS.rear)!
  const wheelRadius = front.getSize(new Vector3()).y / 2
  const frontZ = front.getCenter(new Vector3()).z
  const rearZ = rear.getCenter(new Vector3()).z
  body.geometry = mergeGeometries([
    body.geometry,
    // just inside the wheels, so the box fills the arches without ever showing
    // past them however low you crouch
    underbody({ halfWidth: front.min.x + 0.03, frontZ, rearZ, wheelRadius }),
  ])!
  body.geometry.computeBoundingBox()

  return {
    node,
    scale,
    size: { length: size.z * scale, width: size.x * scale, height: size.y * scale },
    wheelRadius,
    wheelBase: frontZ - rearZ,
  }
}

function load(model: CarModel, directory: string): Group {
  const materials = new MTLLoader().parse(readFileSync(join(directory, `${model}.mtl`), 'utf8'), '')
  materials.preload()
  return new OBJLoader().setMaterials(materials).parse(readFileSync(join(directory, `${model}.obj`), 'utf8'))
}

/** Moves a wheel's mesh onto a pivot at its axle. */
function pivot(mesh: Mesh, name: string, node: Group): void {
  const axle = mesh.geometry.boundingBox!.getCenter(new Vector3())
  mesh.geometry.translate(-axle.x, -axle.y, -axle.z)
  mesh.geometry.computeBoundingBox()
  mesh.name = ''
  const hub = new Group()
  hub.name = name
  hub.position.copy(axle)
  hub.add(mesh)
  node.add(hub)
}

/**
 * The one claim the whole box rests on: `heading` is `rotation.y` for a model
 * whose nose points down +Z. The lamps say which end is which, so this checks
 * them rather than trusting the file. It runs while the mesh still wears the
 * pack's own materials, which is the only place their names are written down.
 */
function facesForward(model: CarModel, body: Mesh): void {
  const head = zRangeOf(body, 'Headlights')
  const tail = zRangeOf(body, 'TailLights')
  if (!head || !tail) throw new Error(`${model}: no headlights or tail lights to tell the nose from the tail`)
  if (head.min <= 0 || tail.max >= 0) {
    throw new Error(`${model}: headlights at z ${head.min.toFixed(2)}, tail lights at z ${tail.max.toFixed(2)}: the nose does not point +Z`)
  }
}

/** Where the triangles wearing one material sit along Z. */
function zRangeOf(mesh: Mesh, material: string): { min: number; max: number } | undefined {
  const worn: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const position = mesh.geometry.getAttribute('position')
  const index = mesh.geometry.index
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const group of mesh.geometry.groups) {
    if (worn[group.materialIndex ?? 0]?.name !== material) continue
    for (let i = group.start; i < group.start + group.count; i++) {
      const z = position.getZ(index ? index.getX(i) : i)
      min = Math.min(min, z)
      max = Math.max(max, z)
    }
  }
  return min <= max ? { min, max } : undefined
}
