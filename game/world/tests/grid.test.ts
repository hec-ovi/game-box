import { describe, expect, it } from 'vitest'
import { MAX_GRID_SIDE, World } from '../src/index.ts'
import { docOf, problemsOf, unwrap, violationsOf } from './house.ts'

const spec = { name: 'Wide Valley', theme: 'plain', seed: 'grid' }

const RING = 4
const BLOCK = 22
/** Where a block's yard starts, counting from the ring: 2 cells of pavement, 5 of roadway, 2 of pavement, then the block. */
const FIRST = RING + 9
/** The last block a grid of this side fits, so a test can build on the far corner. */
const lastBlock = (side: number) => FIRST + BLOCK * Math.floor((side - RING - FIRST - 13) / BLOCK)

/** A town of 22-cell blocks: a road band every block, a strip of building either side of the yard. */
function town(side: number): World {
  const world = World.create({ ...spec, width: side, height: side })
  world.paint({ x: 0, y: 0, w: side, h: RING }, 'mountain')
  world.paint({ x: 0, y: side - RING, w: side, h: RING }, 'mountain')
  for (let line = RING; line + 9 <= side - RING; line += BLOCK) {
    world.paint({ x: RING, y: line, w: side - RING * 2, h: 9 }, 'sidewalk')
    world.paint({ x: RING, y: line + 2, w: side - RING * 2, h: 5 }, 'street')
    world.paint({ x: line, y: RING, w: 9, h: side - RING * 2 }, 'sidewalk')
    world.paint({ x: line + 2, y: RING, w: 5, h: side - RING * 2 }, 'street')
  }
  for (let y = FIRST; y <= lastBlock(side); y += BLOCK) {
    for (let x = FIRST; x <= lastBlock(side); x += BLOCK) {
      world.paint({ x, y, w: 13, h: 4 }, 'building')
      world.paint({ x, y: y + 9, w: 13, h: 4 }, 'building')
    }
  }
  return world
}

describe('how a city writes its grid', () => {
  it('founds a city as runs and reads the picture back', () => {
    const world = World.create({ ...spec, width: 16, height: 16 })
    world.paint({ x: 0, y: 5, w: 16, h: 2 }, 'street')
    const doc = docOf(world)
    expect(doc.grid.runs[5]).toBe('16S')
    expect(doc.grid.rows).toBeUndefined()
    expect(unwrap(World.load(doc)).grid.at(3, 5)).toBe('street')
  })

  it('leaves a file written a char a cell as it was written, through a change and out again', () => {
    const world = World.create({ ...spec, width: 16, height: 16 })
    world.paint({ x: 0, y: 5, w: 16, h: 2 }, 'street')
    const cells = [...world.grid.rows()]
    const file = { ...docOf(world), grid: { width: 16, height: 16, rows: cells } }

    const opened = unwrap(World.load(JSON.parse(JSON.stringify(file))))
    expect(JSON.stringify(opened.toJSON())).toBe(JSON.stringify(file))

    opened.paint({ x: 0, y: 8, w: 4, h: 1 }, 'park')
    const saved = opened.toJSON().grid
    expect(saved.runs).toBeUndefined()
    expect(saved.rows?.[8]).toBe('PPPP............')
  })

  it('refuses a grid written both ways, or neither', () => {
    const doc = docOf(World.create({ ...spec, width: 16, height: 16 }))
    expect(violationsOf(World.load({ ...doc, grid: { ...doc.grid, rows: doc.grid.runs } }))).toContain('grid.rows')
    expect(violationsOf(World.load({ ...doc, grid: { width: 16, height: 16 } }))).toContain('grid.rows')
  })

  it('reports a run no grid could hold instead of allocating it', () => {
    const doc = docOf(World.create({ ...spec, width: 16, height: 16 }))
    doc.grid.runs[2] = '999999999B'
    expect(problemsOf(World.load(doc))).toContainEqual(expect.stringContaining('row 2 is 17 cells'))
  })
})

describe('a city at the biggest grid the document holds', () => {
  it('paints it, builds on the far corner, and saves to the same bytes it opens from', () => {
    const world = town(MAX_GRID_SIDE)
    const far = lastBlock(MAX_GRID_SIDE)
    expect(world.grid.at(far, far)).toBe('building')
    unwrap(
      world.addPlot({
        kind: 'house',
        name: 'Far Corner',
        rect: { x: far, y: far + 4, w: 4, h: 5 },
        entrance: { cell: { x: far, y: far + 3 }, facing: 'north' },
        storeys: 1,
        style: 'timber',
      }),
    )

    const json = JSON.stringify(world.toJSON())
    const reopened = unwrap(World.load(JSON.parse(json)))
    expect(reopened.check()).toEqual([])
    expect(JSON.stringify(reopened.toJSON())).toBe(json)

    // 4,194,304 cells: 1.25 MB of runs against the 4.01 MB the same picture costs a char a cell.
    const picture = world.grid.rows().join('').length
    expect(picture).toBe(MAX_GRID_SIDE * MAX_GRID_SIDE)
    expect(json.length).toBeLessThan(picture / 3)
  })
})
