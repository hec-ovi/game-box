import { FURNITURE_PROPS } from '@gb/world'
import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FURNISH_STYLES, furnishKit } from '../src/index.ts'

/**
 * Same seed, same furniture, always.
 *
 * The whole catalog is drawn from one stream forked per language and per prop,
 * so a room furnishes the same way on the second visit as on the first, and
 * adding a prop kind cannot change the shape of one already in the world.
 */

function positions(seed: string): Map<string, Float32Array> {
  const kit = furnishKit(seed)
  const found = new Map<string, Float32Array>()
  for (const style of FURNISH_STYLES) {
    for (const prop of FURNITURE_PROPS) {
      const attribute = kit.geometry(prop, style).getAttribute('position') as THREE.BufferAttribute
      found.set(`${style}/${prop}`, attribute.array as Float32Array)
    }
  }
  return found
}

describe('a seed', () => {
  it('builds the same catalog twice, vertex for vertex', () => {
    const first = positions('a-town')
    const second = positions('a-town')

    expect([...second.keys()]).toEqual([...first.keys()])
    for (const [key, array] of first) {
      expect(Array.from(second.get(key)!), key).toEqual(Array.from(array))
    }
  })

  it('builds a different catalog from a different seed', () => {
    const first = positions('a-town')
    const other = positions('another-town')

    const changed = [...first].filter(([key, array]) => {
      const rival = other.get(key)!
      return rival.length !== array.length || rival.some((value, at) => value !== array[at])
    })
    expect(changed.length).toBeGreaterThan(first.size / 3)
  })
})
