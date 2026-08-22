import { METRICS, cellCentre, type CellKind, type World } from '@gb/world'
import * as THREE from 'three'
import type { Dressing } from './dressing.ts'

const MOUNTAIN_HEIGHT = 26
const GROUND_KINDS: readonly CellKind[] = ['street', 'sidewalk', 'park', 'empty', 'water']

export interface CityBuild {
  readonly root: THREE.Group
  /** Every building, by plot id, so the game can find what the player is looking at. */
  readonly buildings: ReadonlyMap<string, THREE.Object3D>
  /** Where each building's door is, in metres. */
  readonly doorsteps: ReadonlyMap<string, THREE.Vector3>
}

/**
 * Turns a city into something you can stand in. Ground is one merged mesh per
 * surface, buildings come from the dressing at the size the plot says, and
 * everything lands where the grid puts it, in metres.
 */
export function buildCity(world: World, dressing: Dressing): CityBuild {
  const root = new THREE.Group()
  root.name = world.id

  for (const kind of GROUND_KINDS) {
    const mesh = groundMesh(world, kind, dressing)
    if (mesh) root.add(mesh)
  }
  const mountains = mountainMesh(world, dressing)
  if (mountains) root.add(mountains)

  const buildings = new Map<string, THREE.Object3D>()
  const doorsteps = new Map<string, THREE.Vector3>()
  const cell = world.cellSize

  for (const plot of world.plots()) {
    const size = {
      width: plot.rect.w * cell,
      depth: plot.rect.h * cell,
      height: storeyHeight(plot.storeys),
    }
    const object = dressing.building(plot, size)
    const centre = cellCentre(plot.rect.x + plot.rect.w / 2 - 0.5, plot.rect.y + plot.rect.h / 2 - 0.5, cell)
    object.position.set(centre.x, 0, centre.z)
    root.add(object)
    buildings.set(plot.id, object)

    const doorstep = cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, cell)
    doorsteps.set(plot.id, new THREE.Vector3(doorstep.x, 0, doorstep.z))
  }

  return { root, buildings, doorsteps }
}

/** Ground floor is taller than the rest, the way a real street front is. */
export function storeyHeight(storeys: number): number {
  const { groundFloorHeight, storeyHeight: upper } = METRICS.building
  return groundFloorHeight + Math.max(0, storeys - 1) * upper
}

/** One mesh for every cell of a kind: a city of thousands of cells stays a handful of draws. */
function groundMesh(world: World, kind: CellKind, dressing: Dressing): THREE.Mesh | undefined {
  const cells: Array<{ x: number; y: number }> = []
  for (let y = 0; y < world.grid.height; y++) {
    for (let x = 0; x < world.grid.width; x++) {
      if (world.grid.at(x, y) === kind) cells.push({ x, y })
    }
  }
  if (!cells.length) return undefined

  const size = world.cellSize
  const positions = new Float32Array(cells.length * 6 * 3)
  const normals = new Float32Array(cells.length * 6 * 3)
  const height = kind === 'sidewalk' ? METRICS.street.curbHeight : 0

  cells.forEach((cell, index) => {
    const centre = cellCentre(cell.x, cell.y, size)
    const half = size / 2
    const corners = [
      [centre.x - half, centre.z - half],
      [centre.x + half, centre.z - half],
      [centre.x + half, centre.z + half],
      [centre.x - half, centre.z - half],
      [centre.x + half, centre.z + half],
      [centre.x - half, centre.z + half],
    ]
    corners.forEach(([px, pz], corner) => {
      const at = (index * 6 + corner) * 3
      positions[at] = px!
      positions[at + 1] = height
      positions[at + 2] = pz!
      normals[at + 1] = 1
    })
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  const mesh = new THREE.Mesh(geometry, dressing.ground(kind))
  mesh.name = `ground:${kind}`
  mesh.receiveShadow = true
  return mesh
}

/** The ring that closes the valley, as one instanced block per mountain cell. */
function mountainMesh(world: World, dressing: Dressing): THREE.InstancedMesh | undefined {
  const cells: Array<{ x: number; y: number }> = []
  for (let y = 0; y < world.grid.height; y++) {
    for (let x = 0; x < world.grid.width; x++) {
      if (world.grid.at(x, y) === 'mountain') cells.push({ x, y })
    }
  }
  if (!cells.length) return undefined

  const size = world.cellSize
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(size, MOUNTAIN_HEIGHT, size),
    dressing.ground('mountain'),
    cells.length,
  )
  mesh.name = 'mountains'
  const matrix = new THREE.Matrix4()
  cells.forEach((cell, index) => {
    const centre = cellCentre(cell.x, cell.y, size)
    matrix.makeTranslation(centre.x, MOUNTAIN_HEIGHT / 2 - 2, centre.z)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}
