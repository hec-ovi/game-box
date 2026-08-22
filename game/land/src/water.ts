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

  const spread = theme.relief.open * 0.85
  const candidates: Array<Basin & { tilt: number }> = []
  for (let i = 0; i < count * 14; i++) {
    const angle = (i + rng.float() * 0.85) * ((Math.PI * 2) / (count * 14))
    const out = rng.float() * spread
    // the further out a pond is the bigger it has to be, because the ground it
    // sits in is drawn in bigger squares out there
    const reach = radius * rng.range(0.7, 1.9) * (1 + out / 620)
    const site = marchOut(height, centre, angle, reach + CLEARANCE + out)
    if (!site) continue
    if (height.awayFromTown(site.x, site.z) < reach + CLEARANCE) continue

    let low = Infinity
    let high = -Infinity
    for (let spoke = 0; spoke < SPOKES; spoke++) {
      const theta = (spoke / SPOKES) * Math.PI * 2
      const rim = height.base(site.x + Math.cos(theta) * reach, site.z + Math.sin(theta) * reach)
      low = Math.min(low, rim)
      high = Math.max(high, rim)
    }
    // too tilted to hold a pond: the water would run out of one side
    if (high - low > depth * 4) continue

    candidates.push({
      x: site.x,
      z: site.z,
      radius: reach,
      rim: low,
      surface: low - LIP,
      bed: low - LIP - depth,
      tilt: high - low,
    })
  }

  // even ground first, and low ground over high, because water gathers downhill
  candidates.sort((a, b) => a.tilt + a.rim * 0.25 - (b.tilt + b.rim * 0.25))
  const taken: Basin[] = []
  for (const candidate of candidates) {
    if (taken.length >= count) break
    const clear = taken.every(
      (other) => Math.hypot(other.x - candidate.x, other.z - candidate.z) > (other.radius + candidate.radius) * 3,
    )
    if (!clear) continue
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
  for (let distance = 0; distance < 5000; distance += 8) {
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
export function buildWater(ground: Surface, carved: readonly Basin[], theme: LandTheme): WaterBuild {
  const positions: number[] = []
  const indices: number[] = []
  const basins: Basin[] = []

  for (const basin of carved) {
    const shore: number[] = []
    for (let spoke = 0; spoke < SPOKES; spoke++) {
      const reach = shoreline(ground, basin, (spoke / SPOKES) * Math.PI * 2)
      if (reach === undefined) break
      shore.push(reach)
    }
    // a bowl the drawn ground does not close on every side stays a dry hollow
    if (shore.length < SPOKES) continue

    basins.push(basin)
    const centre = positions.length / 3
    positions.push(basin.x, basin.surface, basin.z)
    for (let spoke = 0; spoke < SPOKES; spoke++) {
      const theta = (spoke / SPOKES) * Math.PI * 2
      positions.push(basin.x + Math.cos(theta) * shore[spoke]!, basin.surface, basin.z + Math.sin(theta) * shore[spoke]!)
    }
    for (let spoke = 0; spoke < SPOKES; spoke++) {
      const here = centre + 1 + spoke
      const next = centre + 1 + ((spoke + 1) % SPOKES)
      indices.push(centre, next, here)
    }
  }
  if (!basins.length) return { mesh: undefined, basins }

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
  return { mesh, basins }
}

export interface WaterBuild {
  readonly mesh: THREE.Mesh | undefined
  /** The basins that hold water. Any other carve is just a dip in the ground. */
  readonly basins: readonly Basin[]
}

/**
 * How far the water reaches along one heading: a walk outward to where the land
 * first comes back up through the surface, then closed in on it. The answer is
 * always the wet side of that line, so the shore is never drawn over dry ground.
 */
function shoreline(ground: Surface, basin: Basin, theta: number): number | undefined {
  const dx = Math.cos(theta)
  const dz = Math.sin(theta)
  const at = (reach: number): number => ground.heightAt(basin.x + dx * reach, basin.z + dz * reach)

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
    return inset(wet)
  }
  return undefined
}

/** A centimetre back from the line, so the edge stays wet once it is a float32. */
function inset(reach: number): number {
  return Math.max(0, reach - 0.01)
}

/** Anything that can say how high the ground is: the built ground, in practice. */
export interface Surface {
  heightAt(x: number, z: number): number
}

/** The water level standing at a point, or undefined where the ground is dry. */
export function waterLevelAt(
  basins: readonly Basin[],
  ground: Surface,
  x: number,
  z: number,
): number | undefined {
  for (const basin of basins) {
    if (Math.hypot(x - basin.x, z - basin.z) >= basin.radius) continue
    if (ground.heightAt(x, z) <= basin.surface) return basin.surface
  }
  return undefined
}
