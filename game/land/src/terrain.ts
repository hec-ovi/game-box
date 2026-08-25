import * as THREE from 'three'
import type { Ground } from './ground.ts'
import { clamp01, smoothstep01 } from './height.ts'
import type { Noise } from './noise.ts'
import type { LandTheme } from './theme.ts'

export interface TerrainBuild {
  readonly mesh: THREE.Mesh
  readonly triangles: number
  readonly vertices: number
}

/**
 * The land, as one mesh: every quad of every tier of the ground, welded into
 * the same vertices, from the verge at the kerb line out to the horizon. The
 * town's own cells are never among them, so nothing here is ever laid over a
 * street or a plot.
 */
export function buildTerrain(ground: Ground, theme: LandTheme, noise: Noise): TerrainBuild {
  const mesher = new Mesher()
  for (const quad of ground.quads()) {
    mesher.quad(
      [quad.x0, quad.z0, quad.h00],
      [quad.x1, quad.z0, quad.h10],
      [quad.x1, quad.z1, quad.h11],
      [quad.x0, quad.z1, quad.h01],
    )
  }

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

/** Builds one welded vertex list, so the pieces cannot crack apart. */
class Mesher {
  readonly positions: number[] = []
  readonly indices: number[] = []
  readonly #seen = new Map<number, number>()

  /** Four corners in order around the quad, each `[x, z, height]`. */
  quad(a: Corner, b: Corner, c: Corner, d: Corner): void {
    const p0 = this.#vertex(a)
    const p1 = this.#vertex(b)
    const p2 = this.#vertex(c)
    const p3 = this.#vertex(d)
    this.indices.push(p0, p2, p1, p0, p3, p2)
  }

  #vertex(corner: Corner): number {
    // one number per place, to a tenth of a metre: every lattice lands on those
    const key = (Math.round(corner[0] * 10) + 1e6) * 4194304 + Math.round(corner[1] * 10) + 1e6
    const known = this.#seen.get(key)
    if (known !== undefined) return known
    const index = this.positions.length / 3
    this.positions.push(corner[0], corner[2], corner[1])
    this.#seen.set(key, index)
    return index
  }
}

type Corner = readonly [x: number, z: number, height: number]

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
    colour.lerp(snowColour, smoothstep01((y - snowAt) / 60))

    const shade = 1 + noise.fbm(x / 26 + 5.5, z / 26 - 3.1, 2) * 0.07
    colours[i * 3] = clamp01(colour.r * shade)
    colours[i * 3 + 1] = clamp01(colour.g * shade)
    colours[i * 3 + 2] = clamp01(colour.b * shade)
  }
  return new THREE.BufferAttribute(colours, 3)
}
