import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { FURNITURE_PROPS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { PIECES, PIECE_IDS, PROP_ART, piecesUsed } from '../src/index.ts'
import { frontOn, measurePiece, PACK_DIRECTORY } from '../tools/measure.ts'

const source = Object.values(PACK_DIRECTORY).every((directory) => existsSync(directory))

describe('the catalog', () => {
  it('has art for every prop and uses every piece it lists', () => {
    expect(Object.keys(PROP_ART).sort()).toEqual([...FURNITURE_PROPS].sort())
    expect(piecesUsed().sort()).toEqual([...PIECE_IDS].sort())
  })
})

// the source packs arrive with the asset fetch; without them there is nothing to measure
describe.skipIf(!source)('against the source art', () => {
  it('names a model that is in the pack, under the node the pack builder merges', () => {
    for (const id of PIECE_IDS) {
      expect(existsSync(join(PACK_DIRECTORY[PIECES[id].pack], `${id}.gltf`)), id).toBe(true)
      expect(measurePiece(id).node, id).toBe(id)
    }
  })

  it('points every piece the way the geometry says it faces', () => {
    for (const id of PIECE_IDS) {
      const front = PIECES[id].front
      const axis = front.endsWith('x') ? 'x' : 'z'
      const measured = frontOn(measurePiece(id), axis)

      // a barrel and a stone block have no front; anything with a back to it does
      if (measured) expect(`${measured}${axis}`, id).toBe(front)
    }
  })
})
