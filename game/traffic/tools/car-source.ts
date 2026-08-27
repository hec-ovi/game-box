import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Group, Mesh, type BufferGeometry, type Material } from 'three'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { CAR_PARTS, type CarPart } from '../src/pack-layout.ts'
import type { CarModel } from '../src/settings.ts'
import { assemble, type CarBuild, type CarPieces } from './car-parts.ts'
import { bakeSurfaces } from './car-shading.ts'

/**
 * Turns one car of the Quaternius pack (an .obj and its .mtl) into the pieces
 * `car-parts.ts` assembles. The pack names its own wheels and paints its lamps
 * with materials called Headlights and TailLights, so nothing here has to be
 * guessed: which mesh is which comes off the names, and which way the car faces
 * comes off the lamps.
 */

/** Which source object is which, by the names Quaternius gave them. */
const PART_OF: ReadonlyArray<readonly [string, CarPart]> = [
  ['FrontLeftWheel', CAR_PARTS.frontLeft],
  ['FrontRightWheel', CAR_PARTS.frontRight],
  ['BackWheels', CAR_PARTS.rear],
]

export function buildCar(model: CarModel, directory: string): CarBuild {
  const source = load(model, directory)
  const meshes = source.children.filter((child): child is Mesh => child instanceof Mesh)
  if (meshes.length !== PART_OF.length + 1) {
    throw new Error(`${model}: expected a body and ${PART_OF.length} wheels, found ${meshes.length} objects`)
  }

  const body = meshes.find((mesh) => !PART_OF.some(([name]) => mesh.name.includes(name)))
  if (!body) throw new Error(`${model}: no body mesh`)
  facesForward(model, body)

  const wheels = new Map<CarPart, BufferGeometry>()
  for (const mesh of meshes) {
    bakeSurfaces(mesh)
    const part = PART_OF.find(([source]) => mesh.name.includes(source))
    if (part) wheels.set(part[1], mesh.geometry)
  }
  for (const [, part] of PART_OF) {
    if (!wheels.has(part)) throw new Error(`${model}: the source has no ${part}`)
  }

  const pieces: CarPieces = { body: body.geometry, wheels }
  return assemble(model, pieces)
}

function load(model: CarModel, directory: string): Group {
  const materials = new MTLLoader().parse(readFileSync(join(directory, `${model}.mtl`), 'utf8'), '')
  materials.preload()
  return new OBJLoader().setMaterials(materials).parse(readFileSync(join(directory, `${model}.obj`), 'utf8'))
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
  if (head.min <= tail.max) {
    throw new Error(
      `${model}: headlights at z ${head.min.toFixed(2)}, tail lights at z ${tail.max.toFixed(2)}: the nose does not point +Z`,
    )
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
