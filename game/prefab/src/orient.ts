import type { Facing } from '@gb/world'
import type * as THREE from 'three'
import { ENTRANCE_ATTRIBUTE } from './doorway.ts'

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
 * A model turned onto its plot, mirrored if its design says so, and with its
 * rooms slid along.
 *
 * Every number here is a swap or a sign flip, never a sine, so the same model
 * lands on the same coordinates on every machine and the city a seed builds is
 * the same city everywhere. Mirroring happens in the model's own frame, before
 * the turn, so the door stays where it was and only the facade swaps hands.
 *
 * `rooms` is how many whole pictures to slide the wall's uv along. The pictures
 * tile, so the wall looks identical; what moves is which bay of the wall each
 * fragment thinks it is in, and that is what the shader hashes the room out of.
 * Without it two plots that drew the same model would look into the same rooms.
 */
export function orient(geometry: THREE.BufferGeometry, turns: 0 | 1 | 2 | 3, mirror: boolean, rooms = 0): THREE.BufferGeometry {
  const out = geometry.clone()
  spin(out.getAttribute('position').array as Float32Array, turns, mirror)
  spin(out.getAttribute('normal').array as Float32Array, turns, mirror)
  if (rooms !== 0) {
    slide(out.getAttribute('uv').array as Float32Array, rooms, 2)
    // where the entrance stands is written in that same uv, so it moves with it
    const entrance = out.getAttribute(ENTRANCE_ATTRIBUTE)
    if (entrance) slide(entrance.array as Float32Array, rooms, 4, 2)
  }
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

/** Whole pictures along the wall. Whole, because half of one would move the picture too. */
function slide(values: Float32Array, by: number, stride: number, along = 1): void {
  for (let i = 0; i < values.length; i += stride) for (let u = 0; u < along; u++) values[i + u] = values[i + u]! + by
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
