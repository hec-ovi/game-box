import { attribute, float, select, uniform } from 'three/tsl'
import { MeshPhysicalNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { headlampLevel } from './night.ts'
import { CAR_SURFACES, METAL_LIFT, type CarSurface } from './pack-layout.ts'

/**
 * How a car is shaded. One material for the whole pack: the base colour and
 * which surface a triangle is come off the vertices, so a body, its glass, its
 * lamps, its tyres and its rims are one draw and still look like five things.
 *
 * A car is the shiniest thing in a street, and the sky is what it reflects.
 * Paint is metal under a clear coat, glass is a near-black mirror, and the
 * lamps carry their own light once it is dark.
 */

interface Look {
  readonly roughness: number
  readonly metalness: number
  readonly clearcoat: number
  readonly clearcoatRoughness: number
  /** What the base colour is multiplied by when the lamps are on. */
  readonly glow: number
}

const LOOK: Readonly<Record<CarSurface, Look>> = {
  [CAR_SURFACES.paint]: { roughness: 0.32, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.1, glow: 0 },
  [CAR_SURFACES.glass]: { roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, glow: 0 },
  [CAR_SURFACES.lamp]: { roughness: 0.18, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.08, glow: 5 },
  [CAR_SURFACES.trim]: { roughness: 0.85, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, glow: 0 },
  [CAR_SURFACES.metal]: { roughness: 0.25, metalness: 1, clearcoat: 0.3, clearcoatRoughness: 0.2, glow: 0 },
}

export class CarPaint {
  readonly material: MeshPhysicalNodeMaterial
  readonly #lamps = uniform(0)
  #hours = 12

  constructor() {
    const vertex = attribute<'vec4'>('color', 'vec4')
    const surface = vertex.w.mul(255).round()
    const base = select(is(surface, CAR_SURFACES.metal), vertex.xyz.mul(METAL_LIFT), vertex.xyz)

    const material = new MeshPhysicalNodeMaterial({ name: 'car' })
    material.colorNode = base
    material.roughnessNode = table(surface, 'roughness')
    material.metalnessNode = table(surface, 'metalness')
    material.clearcoatNode = table(surface, 'clearcoat')
    material.clearcoatRoughnessNode = table(surface, 'clearcoatRoughness')
    material.emissiveNode = base.mul(table(surface, 'glow')).mul(this.#lamps)
    this.material = material
  }

  /** The hour of day the lamps are lit for. */
  get hours(): number {
    return this.#hours
  }

  /** How lit the lamps are at that hour: 0 in daylight, 1 in the dark. */
  get lamps(): number {
    return this.#lamps.value
  }

  setTime(hours: number): void {
    if (!Number.isFinite(hours)) return
    this.#hours = hours
    this.#lamps.value = headlampLevel(hours)
  }

  dispose(): void {
    this.material.dispose()
  }
}

/** One `Look` field as a node: whichever surface this fragment is. */
function table(surface: Node<'float'>, field: keyof Look): Node<'float'> {
  const surfaces = Object.values(CAR_SURFACES)
  let out: Node<'float'> = float(LOOK[surfaces[surfaces.length - 1]!][field])
  for (let i = surfaces.length - 2; i >= 0; i--) {
    out = select(is(surface, surfaces[i]!), float(LOOK[surfaces[i]!][field]), out)
  }
  return out
}

function is(surface: Node<'float'>, id: CarSurface): Node<'bool'> {
  return surface.equal(float(id))
}
