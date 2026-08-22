import { World, type CellKind } from '@gb/world'

/** Cells from one street to the next. Three of roadway, a pavement each side, block between. */
const PITCH = 12
const CELLS = 48

function band(index: number): 'street' | 'sidewalk' | 'block' {
  const inPitch = index % PITCH
  if (inPitch < 3) return 'street'
  if (inPitch === 3 || inPitch === PITCH - 1) return 'sidewalk'
  return 'block'
}

function kindAt(x: number, y: number): CellKind | 'block' {
  const across = band(x)
  const down = band(y)
  if (across === 'street' || down === 'street') return 'street'
  if (across === 'sidewalk' || down === 'sidewalk') return 'sidewalk'
  return 'block'
}

/**
 * A hand-laid grid city: streets with pavement both sides, blocks built on,
 * and one of them left as a park. Built here rather than generated so this
 * box's tests answer for this box alone.
 */
export function testTown(seed = 'crowd-town'): World {
  const world = World.create({ name: 'Grid', theme: 'test', seed, width: CELLS, height: CELLS })

  for (let y = 0; y < CELLS; y++) {
    for (let x = 0; x < CELLS; x++) {
      const kind = kindAt(x, y)
      if (kind !== 'block') world.paint({ x, y, w: 1, h: 1 }, kind)
    }
  }

  const inner = PITCH - 5 // the block between its two pavements
  let park = true
  for (let by = 0; by + PITCH <= CELLS; by += PITCH) {
    for (let bx = 0; bx + PITCH <= CELLS; bx += PITCH) {
      const rect = { x: bx + 4, y: by + 4, w: inner, h: inner }
      if (park) {
        world.paint(rect, 'park')
        park = false
        continue
      }
      const built = world.addPlot({
        kind: 'house',
        name: `House ${bx}-${by}`,
        rect,
        entrance: { cell: { x: rect.x, y: rect.y }, facing: 'north' },
        storeys: 2,
        style: 'plain',
      })
      if (!built.ok) throw new Error(`test town could not build at ${bx},${by}: ${built.error.code}`)
    }
  }
  return world
}

/**
 * One pavement running east-west with roadway either side: the narrowest place
 * two people have to pass each other, and the only ground the crowd will spawn
 * on, so a test knows exactly which row everybody is standing in.
 */
export function corridor(cells = 60, seed = 'crowd-corridor'): World {
  const world = World.create({ name: 'Corridor', theme: 'test', seed, width: cells, height: 5 })
  world.paint({ x: 0, y: 1, w: cells, h: 1 }, 'street')
  world.paint({ x: 0, y: 2, w: cells, h: 1 }, 'sidewalk')
  world.paint({ x: 0, y: 3, w: cells, h: 1 }, 'street')
  return world
}
