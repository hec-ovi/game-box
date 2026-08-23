import type { Facing } from '@gb/world'
import type * as THREE from 'three'

/** Quarter turns about +Y that put a model's south door on the wall this plot's entrance is on. */
export function turnsFor(facing: Facing): 0 | 1 | 2 | 3 {
  switch (facing) {
    case 'south':
      return 0
    case 'east':
      return 1
    case 'north':
      return 2
    case 'west':
      return 3
  }
}

/**
 * A model turned onto its plot, and mirrored if its design says so.
 *
 * Every number here is a swap or a sign flip, never a sine, so the same model
 * lands on the same coordinates on every machine and the city a seed builds is
 * the same city everywhere. Mirroring happens in the model's own frame, before
 * the turn, so the door stays where it was and only the facade swaps hands.
 */
export function orient(geometry: THREE.BufferGeometry, turns: 0 | 1 | 2 | 3, mirror: boolean): THREE.BufferGeometry {
  const out = geometry.clone()
  spin(out.getAttribute('position').array as Float32Array, turns, mirror)
  spin(out.getAttribute('normal').array as Float32Array, turns, mirror)
  if (mirror) unwind(out)
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}

/** Mirrors x, then turns, in place. Exact in IEEE: the entries are 0, 1 and -1. */
function spin(values: Float32Array, turns: 0 | 1 | 2 | 3, mirror: boolean): void {
  for (let i = 0; i < values.length; i += 3) {
    const x = mirror ? -values[i]! : values[i]!
    const z = values[i + 2]!
    switch (turns) {
      case 1:
        values[i] = z
        values[i + 2] = -x
        break
      case 2:
        values[i] = -x
        values[i + 2] = -z
        break
      case 3:
        values[i] = -z
        values[i + 2] = x
        break
      default:
        values[i] = x
    }
  }
}

/** A mirror turns every triangle inside out, so every triangle is wound back. */
function unwind(geometry: THREE.BufferGeometry): void {
  const index = geometry.getIndex()
  if (!index) return
  const array = index.array as Uint16Array | Uint32Array
  for (let i = 0; i < array.length; i += 3) {
    const a = array[i]!
    array[i] = array[i + 2]!
    array[i + 2] = a
  }
  index.needsUpdate = true
}
