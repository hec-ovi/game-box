import type { World } from '@gb/world'
import * as THREE from 'three'
import { clamp01, smoothstep01, type HeightField } from './height.ts'
import type { Noise } from './noise.ts'
import type { LandTheme } from './theme.ts'

/** Metres of the first step outward from the map, and how fast the steps grow. */
const FIRST_STEP = 3
const STEP_GROWTH = 1.28

export interface TerrainBuild {
  readonly mesh: THREE.Mesh
  readonly triangles: number
  readonly vertices: number
}

/**
 * The land, as one mesh.
 *
 * Two pieces welded into the same vertices: the grid's mountain cells, at cell
 * resolution, and a skirt of rings that carries the ground outward to the
 * horizon in steps that grow with distance. The town's own cells are left out
 * entirely, so nothing here is ever laid over a street or a plot.
 */
export function buildTerrain(
  world: World,
  height: HeightField,
  theme: LandTheme,
  noise: Noise,
  horizon: number,
): TerrainBuild {
  const mesher = new Mesher(height)
  band(mesher, world)
  skirt(mesher, world, horizon)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesher.positions, 3))
  geometry.setIndex(mesher.indices)
  geometry.computeVertexNormals()
  geometry.setAttribute('color', paint(geometry, theme, noise))
  geometry.computeBoundingSphere()

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  )
  mesh.name = 'land:terrain'
  mesh.receiveShadow = true
  return { mesh, triangles: mesher.indices.length / 3, vertices: mesher.positions.length / 3 }
}

/** One quad per mountain cell: the footprint the grid marks, grown into real ground. */
function band(mesher: Mesher, world: World): void {
  const cell = world.cellSize
  for (let y = 0; y < world.grid.height; y++) {
    for (let x = 0; x < world.grid.width; x++) {
      if (world.grid.at(x, y) !== 'mountain') continue
      const x0 = x * cell
      const z0 = y * cell
      mesher.quad([x0, z0], [x0 + cell, z0], [x0 + cell, z0 + cell], [x0, z0 + cell])
    }
  }
}

/** Rings around the map, out to the horizon, sharing their inner edge with the band. */
function skirt(mesher: Mesher, world: World, horizon: number): void {
  const outline = boundary(world)
  const radii = [0]
  let step = FIRST_STEP
  let reach = 0
  while (reach < horizon) {
    reach += step
    step *= STEP_GROWTH
    radii.push(reach)
  }

  let inner = outline.map((point) => mesher.vertex(point.x, point.z))
  for (let ring = 1; ring < radii.length; ring++) {
    const spread = radii[ring]!
    const outer = outline.map((point) => mesher.vertex(point.x + point.ax * spread, point.z + point.az * spread))
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length
      mesher.face(inner[i]!, outer[i]!, outer[next]!, inner[next]!)
    }
    inner = outer
  }
}

interface Edge {
  readonly x: number
  readonly z: number
  /** Which way this point moves when the ring grows. */
  readonly ax: number
  readonly az: number
}

/** The edge of the map, one point per cell, walked once with the land on the left. */
function boundary(world: World): Edge[] {
  const cell = world.cellSize
  const right = world.grid.width * cell
  const bottom = world.grid.height * cell
  const points: Edge[] = []
  const push = (x: number, z: number): void => {
    points.push({
      x,
      z,
      ax: x === 0 ? -1 : x === right ? 1 : 0,
      az: z === 0 ? -1 : z === bottom ? 1 : 0,
    })
  }

  for (let x = 0; x < right; x += cell) push(x, 0)
  for (let z = 0; z < bottom; z += cell) push(right, z)
  for (let x = right; x > 0; x -= cell) push(x, bottom)
  for (let z = bottom; z > 0; z -= cell) push(0, z)
  return points
}

/** Builds one welded vertex list, so the band and the skirt cannot crack apart. */
class Mesher {
  readonly positions: number[] = []
  readonly indices: number[] = []
  readonly #height: HeightField
  readonly #seen = new Map<string, number>()

  constructor(height: HeightField) {
    this.#height = height
  }

  vertex(x: number, z: number): number {
    const key = `${Math.round(x * 100)}:${Math.round(z * 100)}`
    const known = this.#seen.get(key)
    if (known !== undefined) return known
    const index = this.positions.length / 3
    this.positions.push(x, this.#height.at(x, z), z)
    this.#seen.set(key, index)
    return index
  }

  /** Four corners in order around the quad, seen from above with the ground on the left. */
  quad(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): void {
    this.face(
      this.vertex(a[0], a[1]),
      this.vertex(b[0], b[1]),
      this.vertex(c[0], c[1]),
      this.vertex(d[0], d[1]),
    )
  }

  face(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, c, b, a, d, c)
  }
}

/** Grass low down, bare rock where it is steep, snow on the tops. */
function paint(geometry: THREE.BufferGeometry, theme: LandTheme, noise: Noise): THREE.BufferAttribute {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const { low, high, rock, snow, highAt, snowAt, rockSlope } = theme.ground

  const lowColour = new THREE.Color(low)
  const highColour = new THREE.Color(high)
  const rockColour = new THREE.Color(rock)
  const snowColour = new THREE.Color(snow)
  const colour = new THREE.Color()

  const colours = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const up = Math.max(0.001, normal.getY(i))
    const tilt = Math.sqrt(Math.max(0, 1 - up * up)) / up

    colour.copy(lowColour).lerp(highColour, smoothstep01(y / highAt))
    colour.lerp(rockColour, smoothstep01((tilt - rockSlope) / 0.35))
    colour.lerp(snowColour, smoothstep01((y - snowAt) / 25))

    const shade = 1 + noise.fbm(x / 26 + 5.5, z / 26 - 3.1, 2) * 0.07
    colours[i * 3] = clamp01(colour.r * shade)
    colours[i * 3 + 1] = clamp01(colour.g * shade)
    colours[i * 3 + 2] = clamp01(colour.b * shade)
  }
  return new THREE.BufferAttribute(colours, 3)
}
