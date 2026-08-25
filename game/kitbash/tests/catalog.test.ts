import { existsSync } from 'node:fs'
import { FRONTAGES, KIT_PIECES, OPENNESS, SHIPPED_CHARTERS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { isGlazed, nodeNamesOf, PIECES, PIECE_IDS, RECIPES, RELIEF } from '../src/index.ts'
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

describe('the recipes', () => {
  it('names exactly the pieces a world file may carry', () => {
    expect([...KIT_PIECES].sort()).toEqual([...PIECE_IDS].sort())
  })

  it('hold the row every preset was resolved to, and a blank front glazes nothing', () => {
    for (const charter of SHIPPED_CHARTERS) {
      const row = RECIPES[charter.street.frontage][charter.street.openness]
      // the chapel keeps its own upper window on the masonry row; every other preset is the row itself
      const expected = charter.word === 'chapel' ? { ...row, upper: { ...row.upper, window: charter.built.upper.window } } : row
      expect(charter.built, charter.word).toEqual(expected)
    }
    for (const frontage of FRONTAGES) {
      for (const openness of OPENNESS) {
        const { street, flank, upper } = RECIPES[frontage][openness]
        expect(upper.rhythm, `${frontage} ${openness}`).toBe({ dense: 1, even: 2, sparse: 3 }[openness])
        const glazed = [street, flank, upper].some((course) => isGlazed(course.window))
        expect(glazed, `${frontage} ${openness}`).toBe(frontage !== 'blank')
      }
    }
  })
})
