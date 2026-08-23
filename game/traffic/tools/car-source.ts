import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Box3, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3, type Color, type Material } from 'three'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { CAR_FOOTPRINT, CAR_PARTS, partName, type CarPart } from '../src/pack-layout.ts'
import type { CarModel } from '../src/settings.ts'

/**
 * Turns one car of the Quaternius pack (an .obj and its .mtl) into the node the
 * game drives: sized to the footprint the simulation reserves, sitting on the
 * road at y = 0, centred on its own middle, nose down +Z, each wheel on a pivot
 * at its axle so it can be spun and steered.
 */

/** Which source object is which, by the names Quaternius gave them. */
const PART_OF: ReadonlyArray<readonly [string, CarPart]> = [
  ['FrontLeftWheel', CAR_PARTS.frontLeft],
  ['FrontRightWheel', CAR_PARTS.frontRight],
  ['BackWheels', CAR_PARTS.rear],
]

/** Surface per material name. The pack has no textures, only flat colours. */
const FINISH: Record<string, { roughness: number; metalness: number }> = {
  default: { roughness: 0.55, metalness: 0.1 },
  Windows: { roughness: 0.12, metalness: 0.5 },
}

/** Lamps carry their own colour, so they read at dusk without a light on them. */
const GLOW = 0.35

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

  const node = new Group()
  node.name = model
  const wheels = new Map<CarPart, Vector3>()
  for (const mesh of meshes) {
    mesh.geometry.applyMatrix4(place)
    // every face in the pack is flat shaded, so the normals say nothing the
    // triangles do not. Dropping them lets the corners weld and the renderer
    // shade flat, which is the look these models were built for.
    mesh.geometry.deleteAttribute('normal')
    mesh.geometry.computeBoundingBox()
    mesh.material = restyle(mesh.material)
    const part = PART_OF.find(([source]) => mesh.name.includes(source))
    if (!part) {
      mesh.name = partName(model, CAR_PARTS.body)
      node.add(mesh)
      continue
    }
    wheels.set(part[1], pivot(mesh, partName(model, part[1]), node))
  }
  for (const [, part] of PART_OF) {
    if (!wheels.has(part)) throw new Error(`${model}: the source has no ${part}`)
  }

  const body = node.getObjectByName(partName(model, CAR_PARTS.body))
  if (!(body instanceof Mesh)) throw new Error(`${model}: no body mesh`)
  facesForward(model, body)

  const front = wheels.get(CAR_PARTS.frontLeft)!
  const wheel = node.getObjectByName(partName(model, CAR_PARTS.frontLeft))!.children[0] as Mesh
  const height = wheel.geometry.boundingBox!.getSize(new Vector3()).y
  return {
    node,
    scale,
    size: { length: size.z * scale, width: size.x * scale, height: size.y * scale },
    wheelRadius: height / 2,
    wheelBase: front.z - wheels.get(CAR_PARTS.rear)!.z,
  }
}

function load(model: CarModel, directory: string): Group {
  const materials = new MTLLoader().parse(readFileSync(join(directory, `${model}.mtl`), 'utf8'), '')
  materials.preload()
  return new OBJLoader().setMaterials(materials).parse(readFileSync(join(directory, `${model}.obj`), 'utf8'))
}

/** Moves a wheel's mesh onto a pivot at its axle, and reports where that axle is. */
function pivot(mesh: Mesh, name: string, node: Group): Vector3 {
  const axle = mesh.geometry.boundingBox!.getCenter(new Vector3())
  mesh.geometry.translate(-axle.x, -axle.y, -axle.z)
  mesh.geometry.computeBoundingBox()
  mesh.name = ''
  const hub = new Group()
  hub.name = name
  hub.position.copy(axle)
  hub.add(mesh)
  node.add(hub)
  return axle
}

/**
 * The one claim the whole box rests on: `heading` is `rotation.y` for a model
 * whose nose points down +Z. The lamps say which end is which, so this checks
 * them rather than trusting the file.
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
  const worn = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
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

/** MTL gives Phong; glTF wants PBR. Same colours, told the way the format says. */
function restyle(material: Material | Material[]): Material | Material[] {
  if (Array.isArray(material)) return material.map((one) => restyle(one) as Material)
  const finish = FINISH[material.name] ?? FINISH['default']!
  const standard = new MeshStandardMaterial({ name: material.name, ...finish })
  const colour = (material as { color?: Color }).color
  if (colour) standard.color.copy(colour)
  if (material.name.endsWith('Lights')) {
    standard.emissive.copy(standard.color)
    standard.emissiveIntensity = GLOW
  }
  return standard
}
