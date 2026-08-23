import { existsSync } from 'node:fs'
import { FURNITURE_PROPS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { PIECES, PIECE_IDS, PROP_ART, piecesUsed } from '../src/index.ts'
import { fileOf, frontOn, measurePiece, PACK_DIRECTORY } from '../tools/measure.ts'

const source = Object.values(PACK_DIRECTORY).every((directory) => existsSync(directory))

describe('the catalog', () => {
  it('has art for every prop and uses every piece it lists', () => {
    expect(Object.keys(PROP_ART).sort()).toEqual([...FURNITURE_PROPS].sort())
    expect(piecesUsed().sort()).toEqual([...PIECE_IDS].sort())
  })
})

// the source packs arrive with the asset fetch; without them there is nothing to measure
describe.skipIf(!source)('against the source art', () => {
  it('names a model that is in the pack and has something drawable in it', () => {
    // the node the loader looks for is written by the pack builder, which refuses
    // to finish without it; what the catalog has to get right is the source file
    for (const id of PIECE_IDS) {
      expect(existsSync(fileOf(id)), id).toBe(true)
      expect(measurePiece(id).triangles, id).toBeGreaterThan(0)
    }
  })

  it('points every piece the way the geometry says it faces', () => {
    for (const id of PIECE_IDS) {
      const front = PIECES[id].front
      const axis = front.endsWith('x') ? 'x' : 'z'
      const measured = frontOn(measurePiece(id), axis)

      // a rug and a standing lamp have no front; anything with a back to it does
      if (measured) expect(`${measured}${axis}`, id).toBe(front)
    }
  })
})
