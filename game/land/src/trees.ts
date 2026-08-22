import type { Rng } from '@gb/kit'
import type { World } from '@gb/world'
import * as THREE from 'three'
import type { HeightField } from './height.ts'
import type { Noise } from './noise.ts'
import type { LandTheme, Species } from './theme.ts'

/** Metres of clear ground kept between anything growing and the town or its road. */
const CLEARANCE = 6
/** Metres across one patch of wood, so trees clump instead of dusting the map evenly. */
const WOOD_SCALE = 62

export interface TreeBuild {
  readonly meshes: readonly THREE.InstancedMesh[]
  readonly count: number
}

/**
 * Woods on the hills, one instanced mesh per species. Nothing grows on the
 * town's cells, within reach of the road out, in the water, above the tree line
 * or on ground too steep to hold roots.
 */
export function buildTrees(
  world: World,
  height: HeightField,
  theme: LandTheme,
  noise: Noise,
  rng: Rng,
  budget: number,
): TreeBuild {
  const spots = plant(world, height, theme, noise, rng, budget)
  if (!spots.length) return { meshes: [], count: 0 }

  const meshes: THREE.InstancedMesh[] = []
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const axis = new THREE.Vector3(0, 1, 0)
  const scale = new THREE.Vector3()
  const position = new THREE.Vector3()

  for (const species of theme.trees.species) {
    const mine = spots.filter((spot) => spot.species === species.id)
    if (!mine.length) continue
    const mesh = new THREE.InstancedMesh(
      treeGeometry(species),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
      mine.length,
    )
    mesh.name = `land:trees:${species.id}`
    mine.forEach((spot, index) => {
      position.set(spot.x, spot.y, spot.z)
      quaternion.setFromAxisAngle(axis, spot.turn)
      scale.set(spot.size, spot.size * spot.stretch, spot.size)
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale))
    })
    mesh.instanceMatrix.needsUpdate = true
    meshes.push(mesh)
  }
  return { meshes, count: spots.length }
}

interface Spot {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly species: string
  readonly turn: number
  readonly size: number
  readonly stretch: number
}

/** Every place a tree is allowed to stand, thinned evenly down to the budget. */
function plant(
  world: World,
  height: HeightField,
  theme: LandTheme,
  noise: Noise,
  rng: Rng,
  budget: number,
): Spot[] {
  const { spacing, density, treeLine, maxSlope, reach, species } = theme.trees
  const cell = world.cellSize
  const right = world.grid.width * cell
  const bottom = world.grid.height * cell
  const shares = species.map((kind) => [kind.id, kind.share] as const)

  const found: Spot[] = []
  for (let z = -reach; z < bottom + reach; z += spacing) {
    for (let x = -reach; x < right + reach; x += spacing) {
      // every candidate draws the same five numbers whether it is taken or not,
      // so moving a threshold cannot reshuffle the whole wood
      const px = x + (rng.float() - 0.5) * spacing
      const pz = z + (rng.float() - 0.5) * spacing
      const turn = rng.float() * Math.PI * 2
      const size = rng.range(0.75, 1.35)
      const stretch = rng.range(0.85, 1.2)

      // inside the map, only the ring belongs to the land: the rest is town
      if (px >= 0 && px < right && pz >= 0 && pz < bottom) {
        if (world.grid.at(Math.floor(px / cell), Math.floor(pz / cell)) !== 'mountain') continue
      }
      if (height.awayFromTown(px, pz) < CLEARANCE) continue

      const y = height.at(px, pz)
      if (y > treeLine) continue
      if (height.waterAt(px, pz) !== undefined) continue
      if (slopeAt(height, px, pz, cell) > maxSlope) continue
      if (wooded(noise, px, pz) < 1 - density) continue

      found.push({ x: px, y, z: pz, species: rng.weighted(shares), turn, size, stretch })
    }
  }

  if (found.length <= budget) return found
  const stride = found.length / budget
  const thinned: Spot[] = []
  for (let i = 0; i < budget; i++) thinned.push(found[Math.floor(i * stride)]!)
  return thinned
}

/** 0 to 1 across the map, spread so `density` reads as the share of ground that is wooded. */
function wooded(noise: Noise, x: number, z: number): number {
  const mask = 0.5 + noise.fbm(x / WOOD_SCALE, z / WOOD_SCALE, 3) * 1.4
  return mask < 0 ? 0 : mask > 1 ? 1 : mask
}

function slopeAt(height: HeightField, x: number, z: number, step: number): number {
  const dx = (height.at(x + step, z) - height.at(x - step, z)) / (2 * step)
  const dz = (height.at(x, z + step) - height.at(x, z - step)) / (2 * step)
  return Math.hypot(dx, dz)
}

/** Trunk and canopy in one low-poly geometry, coloured in the vertices. */
function treeGeometry(species: Species): THREE.BufferGeometry {
  const trunkHeight = species.shape === 'bare' ? species.height : species.height * 0.42
  const trunkWidth = Math.max(0.12, species.spread * 0.09)
  const parts: THREE.BufferGeometry[] = []

  const trunk = new THREE.CylinderGeometry(trunkWidth * 0.7, trunkWidth, trunkHeight, 5, 1)
  trunk.translate(0, trunkHeight / 2, 0)
  parts.push(tint(trunk, species.trunk))

  if (species.shape === 'cone') {
    const canopyHeight = species.height - trunkHeight * 0.4
    const cone = new THREE.ConeGeometry(species.spread / 2, canopyHeight, 7, 1)
    cone.translate(0, trunkHeight * 0.6 + canopyHeight / 2, 0)
    parts.push(tint(cone, species.canopy))
  } else if (species.shape === 'round') {
    const crown = new THREE.IcosahedronGeometry(species.spread / 2, 0)
    crown.scale(1, 0.8, 1)
    crown.translate(0, trunkHeight + species.spread * 0.3, 0)
    parts.push(tint(crown, species.canopy))
  } else {
    for (const [lift, lean] of [[0.62, 1], [0.8, -1]] as const) {
      const branch = new THREE.CylinderGeometry(trunkWidth * 0.3, trunkWidth * 0.45, species.spread * 0.7, 4, 1)
      branch.rotateZ(lean * 1.1)
      branch.translate(lean * species.spread * 0.22, species.height * lift, 0)
      parts.push(tint(branch, species.trunk))
    }
  }
  return merge(parts)
}

function tint(geometry: THREE.BufferGeometry, colour: number): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  if (flat !== geometry) geometry.dispose()
  const count = flat.getAttribute('position').count
  const shade = new THREE.Color(colour)
  const colours = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colours[i * 3] = shade.r
    colours[i * 3 + 1] = shade.g
    colours[i * 3 + 2] = shade.b
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colours, 3))
  flat.deleteAttribute('uv')
  return flat
}

/** Positions, normals and colours of several parts into one geometry. */
function merge(parts: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colours: number[] = []
  for (const part of parts) {
    push(positions, part.getAttribute('position'))
    push(normals, part.getAttribute('normal'))
    push(colours, part.getAttribute('color'))
    part.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
  return geometry
}

function push(into: number[], attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): void {
  for (let i = 0; i < attribute.count; i++) {
    into.push(attribute.getX(i), attribute.getY(i), attribute.getZ(i))
  }
}
