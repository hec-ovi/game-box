import { cellCentre, type World } from '@gb/world'

/** Where one lamp stands, in metres, and which way the road is from it. */
export interface LampSpot {
  readonly x: number
  readonly z: number
  /** Radians about +Y: the lamp's back is to the buildings. */
  readonly rotationY: number
}

/** How far apart lamps stand along a kerb, in metres. */
export const LAMP_SPACING = 20

/** How far in from the kerb edge a lamp stands, so the pavement stays walkable. */
const KERB_GAP = 0.55

/** Which way the road is from a pavement cell, and which way that turns the lamp. */
const SIDES = [
  { dx: 0, dy: -1, rotationY: Math.PI },
  { dx: 1, dy: 0, rotationY: Math.PI / 2 },
  { dx: 0, dy: 1, rotationY: 0 },
  { dx: -1, dy: 0, rotationY: -Math.PI / 2 },
] as const

type Side = (typeof SIDES)[number]

/**
 * Every lamp in the city. Kerbs are read off the grid as runs of pavement with
 * road on one side, and each run gets its lamps spaced evenly along it, at
 * least one however short it is: a stretch of street with no lamp on it is a
 * stretch you cannot see at night.
 *
 * Nothing here draws a random number, so two runs of the same world stand the
 * lamps in the same places.
 */
export function lampSpots(world: World, spacing = LAMP_SPACING): LampSpot[] {
  const cell = world.cellSize
  const spots: LampSpot[] = []
  const taken = new Set<number>()

  for (const side of SIDES) {
    const along = side.dx === 0 // a kerb facing north or south runs east to west
    const lines = along ? world.grid.height : world.grid.width
    const length = along ? world.grid.width : world.grid.height

    for (let line = 0; line < lines; line++) {
      let start = -1
      for (let at = 0; at <= length; at++) {
        const kerb = at < length && onKerb(world, along ? at : line, along ? line : at, side)
        if (kerb && start < 0) start = at
        if (kerb || start < 0) continue

        for (const step of spread(at - start, cell, spacing)) {
          const [x, y] = along ? [start + step, line] : [line, start + step]
          if (taken.has(y * world.grid.width + x)) continue
          taken.add(y * world.grid.width + x)
          const centre = cellCentre(x, y, cell)
          const reach = cell / 2 - KERB_GAP
          spots.push({ x: centre.x + side.dx * reach, z: centre.z + side.dy * reach, rotationY: side.rotationY })
        }
        start = -1
      }
    }
  }
  return spots
}

/** A pavement cell with road on the given side of it. */
function onKerb(world: World, x: number, y: number, side: Side): boolean {
  return world.grid.at(x, y) === 'sidewalk' && world.grid.at(x + side.dx, y + side.dy) === 'street'
}

/** Which cells of a run of `cells` get a lamp, evenly spread and never none. */
function spread(cells: number, cellSize: number, spacing: number): number[] {
  const lamps = Math.max(1, Math.round((cells * cellSize) / spacing))
  const at: number[] = []
  for (let i = 0; i < lamps; i++) at.push(Math.min(cells - 1, Math.floor(((i + 0.5) * cells) / lamps)))
  return [...new Set(at)]
}
