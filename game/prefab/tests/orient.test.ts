import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { orient, turnsFor } from '../src/orient.ts'
import { catalogueOf, libraryOf } from './support.ts'

const geometry = libraryOf(catalogueOf()).geometry('shop-8x12x2')!

/** How many triangles are wound so their face points the way their vertices say it does. */
function outward(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute
  const index = geometry.getIndex()!
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const face = new THREE.Vector3()
  const stored = new THREE.Vector3()
  let agree = 0

  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1))
    c.fromBufferAttribute(position, index.getX(i + 2))
    face.copy(c).sub(b).cross(a.clone().sub(b)).normalize()
    stored.fromBufferAttribute(normal, index.getX(i))
    if (face.dot(stored) > 0.5) agree++
  }
  return agree
}

describe('turning a model onto its plot', () => {
  it('turns a south door onto whichever wall the entrance is on', () => {
    expect([turnsFor('south'), turnsFor('east'), turnsFor('north'), turnsFor('west')]).toEqual([0, 1, 2, 3])
  })

  it('swaps the footprint on a quarter turn and leaves it on a half', () => {
    const size = (turns: 0 | 1 | 2 | 3) => {
      const box = new THREE.Box3().setFromBufferAttribute(orient(geometry, turns, false).getAttribute('position') as THREE.BufferAttribute)
      return [+(box.max.x - box.min.x).toFixed(3), +(box.max.z - box.min.z).toFixed(3)]
    }
    expect(size(0)).toEqual([8, 12.05])
    expect(size(2)).toEqual([8, 12.05])
    expect(size(1)).toEqual([12.05, 8])
    expect(size(3)).toEqual([12.05, 8])
  })

  it('keeps every face pointing out when a model is mirrored', () => {
    const triangles = geometry.getIndex()!.count / 3
    expect(outward(orient(geometry, 0, false))).toBe(triangles)
    expect(outward(orient(geometry, 1, true))).toBe(triangles)
    expect(outward(orient(geometry, 3, true))).toBe(triangles)
  })

  it('moves nothing off a whole number, because every turn is a swap and a sign', () => {
    const before = orient(geometry, 0, false).getAttribute('position').array as Float32Array
    const after = orient(geometry, 2, false).getAttribute('position').array as Float32Array
    for (let i = 0; i < before.length; i += 3) {
      expect(after[i]).toBe(-before[i]!)
      expect(after[i + 1]).toBe(before[i + 1])
      expect(after[i + 2]).toBe(-before[i + 2]!)
    }
  })
})
