import type { Rng } from '@gb/kit'
import * as THREE from 'three'
import type { Basin, HeightField } from './height.ts'
import type { LandTheme } from './theme.ts'

/** Directions used to measure a basin's rim and to draw its shore. */
const SPOKES = 24
/** Metres the water sits below the lowest point of its rim, so it cannot spill. */
const LIP = 0.5
/** Metres of dry ground kept between a basin and the town or its road. */
const CLEARANCE = 6

/**
 * Ponds at the foot of the hills. A site is only taken where the ground around
 * it is even enough to hold water, and the level is set below the lowest point
 * of the rim, so every basin closes on all sides and none of them reaches the
 * town or the road out.
 */
export function carveBasins(height: HeightField, theme: LandTheme, centre: { x: number; z: number }, rng: Rng): Basin[] {
  const { count, radius, depth } = theme.water
  if (count <= 0) return []

  const wanted = radius + CLEARANCE
  const candidates: Array<Basin & { spread: number }> = []
  for (let i = 0; i < count * 12; i++) {
    const angle = (i + rng.float() * 0.85) * ((Math.PI * 2) / (count * 12))
    const site = marchOut(height, centre, angle, wanted + rng.float() * 55)
    if (!site) continue
    if (height.awayFromTown(site.x, site.z) < wanted) continue

    let low = Infinity
    let high = -Infinity
    for (let spoke = 0; spoke < SPOKES; spoke++) {
      const theta = (spoke / SPOKES) * Math.PI * 2
      const rim = height.base(site.x + Math.cos(theta) * radius, site.z + Math.sin(theta) * radius)
      low = Math.min(low, rim)
      high = Math.max(high, rim)
    }
    // too tilted to hold a pond: the water would run out of one side
    if (high - low > depth * 4) continue

    candidates.push({
      x: site.x,
      z: site.z,
      radius,
      rim: low,
      surface: low - LIP,
      bed: low - LIP - depth,
      spread: high - low,
    })
  }

  // the flattest ground first, then anywhere its own basin does not already reach
  candidates.sort((a, b) => a.spread - b.spread || a.rim - b.rim)
  const taken: Basin[] = []
  for (const candidate of candidates) {
    if (taken.length >= count) break
    if (taken.some((other) => Math.hypot(other.x - candidate.x, other.z - candidate.z) < radius * 2.2)) continue
    const basin: Basin = {
      x: candidate.x,
      z: candidate.z,
      radius: candidate.radius,
      rim: candidate.rim,
      surface: candidate.surface,
      bed: candidate.bed,
    }
    taken.push(basin)
    height.addBasin(basin)
  }
  return taken
}

/** The first point along a heading that is far enough out of town. */
function marchOut(
  height: HeightField,
  centre: { x: number; z: number },
  angle: number,
  wanted: number,
): { x: number; z: number } | undefined {
  const dx = Math.cos(angle)
  const dz = Math.sin(angle)
  for (let distance = 0; distance < 2000; distance += 4) {
    const x = centre.x + dx * distance
    const z = centre.z + dz * distance
    if (height.awayFromTown(x, z) >= wanted) return { x, z }
  }
  return undefined
}

/**
 * One mesh for every pond. Each is a fan drawn out to its own shoreline, found
 * by walking outward until the land comes back up through the water level, so
 * the surface always meets the ground it sits in.
 */
export function buildWater(height: HeightField, basins: readonly Basin[], theme: LandTheme): THREE.Mesh | undefined {
  if (!basins.length) return undefined

  const positions: number[] = []
  const indices: number[] = []
  for (const basin of basins) {
    const centre = positions.length / 3
    positions.push(basin.x, basin.surface, basin.z)
    for (let spoke = 0; spoke < SPOKES; spoke++) {
      const theta = (spoke / SPOKES) * Math.PI * 2
      const reach = shoreline(height, basin, theta)
      positions.push(basin.x + Math.cos(theta) * reach, basin.surface, basin.z + Math.sin(theta) * reach)
    }
    for (let spoke = 0; spoke < SPOKES; spoke++) {
      const here = centre + 1 + spoke
      const next = centre + 1 + ((spoke + 1) % SPOKES)
      indices.push(centre, next, here)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: theme.water.colour,
      roughness: 0.12,
      metalness: 0.1,
      transparent: theme.water.opacity < 1,
      opacity: theme.water.opacity,
    }),
  )
  mesh.name = 'land:water'
  mesh.receiveShadow = true
  return mesh
}

/**
 * How far the water reaches along one heading: a walk outward to where the land
 * first comes back up through the surface, then closed in on it. The answer is
 * always the wet side of that line, so the shore is never drawn over dry ground.
 */
function shoreline(height: HeightField, basin: Basin, theta: number): number {
  const dx = Math.cos(theta)
  const dz = Math.sin(theta)
  const at = (reach: number): number => height.at(basin.x + dx * reach, basin.z + dz * reach)

  const steps = 64
  let wet = 0
  for (let step = 1; step <= steps; step++) {
    const reach = (step / steps) * basin.radius
    if (at(reach) < basin.surface) {
      wet = reach
      continue
    }
    let dry = reach
    for (let closing = 0; closing < 8; closing++) {
      const middle = (wet + dry) / 2
      if (at(middle) < basin.surface) wet = middle
      else dry = middle
    }
    return wet
  }
  return wet
}
