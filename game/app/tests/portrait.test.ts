// @vitest-environment jsdom
import type { Cast } from '@gb/cast'
import type { Npc } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Portraits } from '../src/portraits.ts'
import { type Api, pictureOf } from '../src/readback.ts'
import { Bench } from './support/bench.ts'
import { PaperBody } from './support/paper-cast.ts'

/**
 * The face on the conversation panel, at the one step where it can be read
 * wrong without anything throwing: the pixels coming off the GPU.
 *
 * Neither API validates the layout the caller assumes, so a picture read with
 * the wrong row stride or the wrong row order arrives as a full buffer of real
 * bytes in the wrong places, and the panel puts a shredded face on screen with
 * no error anywhere. These are the sizes and shapes the portrait actually uses.
 */

/** The width a portrait is taken at, whose rows WebGPU has to pad: 288 x 4 is 1152 bytes, and 1152 is not a multiple of 256. */
const SIZE = 288

/**
 * A readback as an API really hands one over. Row `y` of the picture is painted
 * with `y` in red and the column in green, so a row landing anywhere but where
 * it belongs is visible pixel by pixel.
 */
function readback(size: number, api: Api): Uint8Array {
  const row = size * 4
  const stride = api === 'webgpu' ? Math.ceil(row / 256) * 256 : row
  const buffer = new Uint8Array((size - 1) * stride + row)
  for (let y = 0; y < size; y++) {
    // WebGL reads a framebuffer from the bottom left, so it hands the bottom row over first
    const at = (api === 'webgpu' ? y : size - 1 - y) * stride
    for (let x = 0; x < size; x++) {
      buffer[at + x * 4] = y % 256
      buffer[at + x * 4 + 1] = x % 256
      buffer[at + x * 4 + 3] = 255
    }
  }
  return buffer
}

/** How many pixels of the picture are not the one that was drawn there. */
function misplaced(picture: Uint8ClampedArray, size: number): number {
  let count = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (picture[i] !== y % 256 || picture[i + 1] !== x % 256) count += 1
    }
  }
  return count
}

describe('the face on the panel', () => {
  it('reads a WebGPU readback with the padding it really carries', () => {
    const pixels = readback(SIZE, 'webgpu')
    // the padding is what this size is here for: without it the test would pass
    // on a stride nobody uses
    expect(pixels.byteLength).toBeGreaterThan(SIZE * SIZE * 4)

    const picture = pictureOf(pixels, SIZE, 'webgpu')

    expect(picture).toBeDefined()
    expect(misplaced(picture!, SIZE)).toBe(0)
  })

  it('reads a WebGL readback the same way up', () => {
    const picture = pictureOf(readback(SIZE, 'webgl'), SIZE, 'webgl')

    expect(picture).toBeDefined()
    expect(misplaced(picture!, SIZE)).toBe(0)
  })

  it('gives nothing back rather than noise when the buffer holds no whole picture', () => {
    // a target that was never drawn into, and one read at a size it was not
    // made at: neither has a face in it, and the panel draws its silhouette
    expect(pictureOf(new Uint8Array(0), SIZE, 'webgpu')).toBeUndefined()
    expect(pictureOf(readback(SIZE, 'webgpu'), SIZE * 2, 'webgpu')).toBeUndefined()
  })
})

describe('drawing a face', () => {
  function someone(id: string): Npc {
    return { id, name: id, role: 'clerk', appearance: { base: 'male', variant: 0 }, personality: 'plain', knowledge: [] }
  }

  it('leaves the bodies the cast handed over whole, so the next person in the same outfit still has a face', async () => {
    // Everybody in one outfit is cloned out of one loaded character and shares
    // its geometry. Giving that back after a portrait takes the clothes off
    // everybody wearing it out in the city, and off the next portrait too.
    const coat = new THREE.BoxGeometry(0.4, 1.8, 0.3).translate(0, 0.9, 0)
    let handedBack = 0
    coat.addEventListener('dispose', () => {
      handedBack += 1
    })
    const cast = {
      spawn: (npc: { id: string }) => {
        const body = new PaperBody(npc.id, [])
        body.object.add(new THREE.Mesh(coat, new THREE.MeshBasicMaterial()))
        return body
      },
      update: () => {},
    } as unknown as Cast
    const portraits = new Portraits({ cast, stage: new Bench(document.createElement('div')) })

    await portraits.of(someone('npc_1'))
    await portraits.of(someone('npc_2'))

    expect(handedBack).toBe(0)
  })
})
