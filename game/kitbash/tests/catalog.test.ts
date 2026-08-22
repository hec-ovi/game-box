import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nodeNamesOf, PIECES, PIECE_IDS, RELIEF } from '../src/index.ts'
import { KIT_DIRECTORY, measurePiece } from '../tools/measure.ts'

const downloaded = existsSync(KIT_DIRECTORY)

describe('the catalog', () => {
  // the kit arrives with tools/fetch-assets.mjs; without it there is nothing to compare against
  it.skipIf(!downloaded)('says what the kit actually contains', () => {
    for (const id of PIECE_IDS) {
      const { node, ...measured } = measurePiece(id)
      expect({ id, ...measured }).toEqual({ id, min: PIECES[id].min, max: PIECES[id].max, materials: PIECES[id].materials })
      // the name a loaded kit is looked up by, which is not always the file name
      expect(nodeNamesOf(id), id).toContain(node)
    }
  })

  it.skipIf(!downloaded)('only names pieces whose outer face is the wall plane', () => {
    for (const id of PIECE_IDS) {
      if (id === 'Roof_2x2') continue // the deck is the one horizontal piece
      const { min, max } = measurePiece(id)
      expect(max[2], `${id} stands too far proud of the wall`).toBeLessThanOrEqual(RELIEF)
      expect(min[2], `${id} is not backed onto the wall plane`).toBeLessThanOrEqual(-0.15)
      expect(max[0] - min[0], `${id} is not one module wide`).toBeCloseTo(2, 2)
    }
  })
})
