import * as THREE from 'three'
import { PANE } from './glass.ts'
import { LAYER_ATTRIBUTE } from './pack.ts'
import { windowsOn } from './windows.ts'

/**
 * The glass of one model, derived from its walls.
 *
 * Every upright face on a windowed layer is copied out and pushed `PANE.stand`
 * along its normal, keeping its uv and its layer, so the glass material cuts
 * the same bays the wall does and the pane lands over the opening. Caps and
 * chamfers on a glazed band are left out: a pane is upright. Nothing is stored
 * in the pack for this, so the stand-off is a runtime number and the mesh file
 * stays the walls alone.
 */
export class Panes {
  readonly #windowed: ReadonlySet<number>

  constructor(finishes: readonly string[]) {
    this.#windowed = new Set(finishes.flatMap((finish, index) => (windowsOn(finish) ? [index] : [])))
  }

  /** The panes of a geometry in its own frame, or nothing when it has no windowed upright face. */
  of(geometry: THREE.BufferGeometry): THREE.BufferGeometry | undefined {
    const index = geometry.getIndex()
    if (!index) return undefined
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const uv = geometry.getAttribute('uv')
    const layer = geometry.getAttribute(LAYER_ATTRIBUTE)

    const kept: number[] = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    for (let t = 0; t < index.count; t += 3) {
      const corners = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      if (corners.some((vertex) => !this.#windowed.has(Math.round(layer.getX(vertex))))) continue
      a.fromBufferAttribute(position as THREE.BufferAttribute, corners[0]!)
      b.fromBufferAttribute(position as THREE.BufferAttribute, corners[1]!)
      c.fromBufferAttribute(position as THREE.BufferAttribute, corners[2]!)
      const face = b.sub(a).cross(c.sub(a)).normalize()
      if (Math.abs(face.y) >= UPRIGHT) continue
      kept.push(...corners)
    }
    if (kept.length === 0) return undefined

    const renumbered = new Map<number, number>()
    for (const vertex of kept) if (!renumbered.has(vertex)) renumbered.set(vertex, renumbered.size)
    const count = renumbered.size
    const positions = new Float32Array(count * 3)
    const normals = new Float32Array(count * 3)
    const uvs = new Float32Array(count * 2)
    const layers = new Float32Array(count)
    for (const [from, to] of renumbered) {
      const nx = normal.getX(from)
      const ny = normal.getY(from)
      const nz = normal.getZ(from)
      positions.set([position.getX(from) + nx * PANE.stand, position.getY(from) + ny * PANE.stand, position.getZ(from) + nz * PANE.stand], to * 3)
      normals.set([nx, ny, nz], to * 3)
      uvs.set([uv.getX(from), uv.getY(from)], to * 2)
      layers[to] = layer.getX(from)
    }

    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    out.setAttribute(LAYER_ATTRIBUTE, new THREE.Float32BufferAttribute(layers, 1))
    out.setIndex(kept.map((vertex) => renumbered.get(vertex)!))
    return out
  }
}

/** A face whose normal leans this far off level is a cap or a chamfer, not a wall a pane stands on. */
const UPRIGHT = 0.5
