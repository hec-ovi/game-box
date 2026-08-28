import type { Facing, Plot, Rect, World } from '@gb/world'

/** How many doors a fixture town opens: what a city opens whatever its size. */
const DOORS = 3

/** How many people stand in each of them. */
const POSTS = 2

/** Frontage and depth of a building put up on free ground, in cells: inside `@gb/world`'s `PLOT_BAND`. */
const FOOTPRINT = { w: 4, h: 5 }

/** Which way a door faces, as the world writes a heading: 0 north, 90 east, 180 south, 270 west. */
const OUTWARD: Record<Facing, number> = { north: 0, east: 90, south: 180, west: 270 }

/**
 * The insides of a laid out town, put in by hand.
 *
 * A plan is the architecture and nothing else: every door is painted on, so
 * there is nowhere to walk into and nobody to meet. What fills a real one is
 * writing, and writing is the model's, so a test gets rooms and posts as data
 * instead: a room the size of the building, its street door on the wall the
 * entrance is in, and somebody standing at each post, all under the labels the
 * plan already carries. Nothing here is written and nothing here is named.
 */
export function openDoors(world: World, doors = DOORS): void {
  for (const plot of world.plots().slice(0, doors)) openDoor(world, plot)
}

/**
 * One more building on ground nothing has claimed, with its door open: the
 * shape of what a growth appends to a city, put up as data because what a real
 * growth adds is written.
 */
export function putUpBuilding(world: World): string {
  const site = world.buildSites(FOOTPRINT.w, FOOTPRINT.h)[0]
  if (!site) throw new Error('the town has no land left to build on')
  const plot = take(
    world.addPlot({
      kind: 'house',
      name: `Instance ${world.plots().length + 1}`,
      rect: site,
      storeys: 2,
      entrance: doorOnto(world, site),
      style: 'brick',
    }),
    'the plot',
  )
  openDoor(world, plot)
  return plot.id
}

/** The cell the front door opens onto: the first pavement the footprint touches. */
function doorOnto(world: World, rect: Rect): { cell: { x: number; y: number }; facing: Facing } {
  const grid = world.grid
  for (let x = rect.x; x < rect.x + rect.w; x += 1) {
    if (grid.at(x, rect.y - 1) === 'sidewalk') return { cell: { x, y: rect.y - 1 }, facing: 'north' }
    if (grid.at(x, rect.y + rect.h) === 'sidewalk') return { cell: { x, y: rect.y + rect.h }, facing: 'south' }
  }
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    if (grid.at(rect.x - 1, y) === 'sidewalk') return { cell: { x: rect.x - 1, y }, facing: 'west' }
    if (grid.at(rect.x + rect.w, y) === 'sidewalk') return { cell: { x: rect.x + rect.w, y }, facing: 'east' }
  }
  throw new Error('the site touches no pavement, so nothing can open onto it')
}

function openDoor(world: World, plot: Plot): void {
  const cell = world.cellSize
  const size = { w: plot.rect.w * cell, h: plot.rect.h * cell }
  const interiorId = world.mintId('interior')
  const roomId = world.mintId('room')
  const anchorIds = Array.from({ length: POSTS }, () => world.mintId('anchor'))

  take(
    world.addInterior({
      id: interiorId,
      plotId: plot.id,
      kind: plot.kind,
      size,
      rooms: [{ id: roomId, kind: 'main', use: 'living-room', name: `Room ${world.interiors().length + 1}`, rect: { x: 0, y: 0, ...size } }],
      doors: [{ id: world.mintId('door'), from: 'outside', to: roomId, ...doorway(size, plot.entrance.facing), locked: false }],
      furniture: [],
      // a stride apart down the middle of the room, so two bodies at their
      // posts are not standing inside one another
      anchors: anchorIds.map((id, at) => ({ id, kind: 'stand' as const, roomId, pos: { x: size.w / 2, y: size.h / 2 + at }, rot: 0 })),
    }),
    'the interior',
  )

  for (const [at, anchorId] of anchorIds.entries()) {
    take(
      world.addNpc({
        id: world.mintId('npc'),
        name: `Person ${world.npcs().length + 1}`,
        role: at === 0 ? 'clerk' : 'resident',
        appearance: { base: at === 0 ? 'female' : 'male', variant: at },
        personality: 'Stands where the plan put them.',
        knowledge: [],
        station: { interiorId, anchorId },
        workPlotId: plot.id,
      }),
      'a person',
    )
  }
}

/** The street door: the middle of the wall the entrance is in, facing out of it. */
function doorway(size: { w: number; h: number }, facing: Facing): { pos: { x: number; y: number }; rot: number } {
  const middle = { x: size.w / 2, y: size.h / 2 }
  const pos =
    facing === 'north'
      ? { x: middle.x, y: 0 }
      : facing === 'south'
        ? { x: middle.x, y: size.h }
        : facing === 'west'
          ? { x: 0, y: middle.y }
          : { x: size.w, y: middle.y }
  return { pos, rot: OUTWARD[facing] }
}

function take<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, what: string): T {
  if (!result.ok) throw new Error(`${what}: ${JSON.stringify(result.error).slice(0, 300)}`)
  return result.value
}
