import { METRICS, SHIPPED_CHARTERS, WIDEST_ROADWAY_CELLS, World, type CellKind, type ResolvedCharter } from '@gb/world'

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

/** The house preset under whatever word a town declares, so a town can be built of a kind no preset ships. */
function charterFor(word: string): ResolvedCharter {
  const house = SHIPPED_CHARTERS.find((charter) => charter.word === 'house')
  if (!house) throw new Error('the shipped charters no longer carry a house')
  return { ...house, word }
}

/**
 * A hand-laid grid city: streets with pavement both sides, blocks built on,
 * and one of them left as a park. Built here rather than generated so this
 * box's tests answer for this box alone. `kind` is the word its buildings are
 * of, declared by the town itself, so a test can walk a city whose kinds of
 * place no preset ships.
 */
export function testTown(kind = 'house'): World {
  const world = World.create({ name: 'Grid', theme: 'test', seed: 'crowd-town', width: CELLS, height: CELLS, charters: [charterFor(kind)] })

  for (let y = 0; y < CELLS; y++) {
    for (let x = 0; x < CELLS; x++) {
      const ground = kindAt(x, y)
      if (ground !== 'block') world.paint({ x, y, w: 1, h: 1 }, ground)
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
        kind,
        name: `Number ${bx}-${by}`,
        rect,
        // the doorstep is the pavement cell in front of the door, the way a generated city lays it
        entrance: { cell: { x: rect.x, y: rect.y - 1 }, facing: 'north' },
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
 * on, so a test knows exactly which row everybody is standing in. `road` is how
 * many cells wide each roadway is, so the same corridor is a side street or an
 * avenue depending on what the test is asking.
 */
export function corridor(cells = 60, seed = 'crowd-corridor', road = 1): World {
  const height = road * 2 + 3
  const world = World.create({ name: 'Corridor', theme: 'test', seed, width: cells, height })
  world.paint({ x: 0, y: 1, w: cells, h: road }, 'street')
  world.paint({ x: 0, y: road + 1, w: cells, h: 1 }, 'sidewalk')
  world.paint({ x: 0, y: road + 2, w: cells, h: road }, 'street')
  return world
}

/**
 * True where a roadway cell of the test town is part of a crossing: the piece
 * of road that interrupts a pavement band at a junction. Worked out from the
 * town's own bands rather than from anything the crowd builds, so a test using
 * it is not asking the crowd to mark its own homework.
 */
export function atCrossing(x: number, y: number): boolean {
  const alongRow = band(y) === 'sidewalk' && band(x) === 'street'
  const alongColumn = band(x) === 'sidewalk' && band(y) === 'street'
  return alongRow || alongColumn
}

/** A run of cells along one axis: where a band starts and where it stops. */
type Span = readonly [number, number]

interface Axis {
  readonly road: Span[]
  readonly pavement: Span[]
  readonly length: number
}

const BLOCK = 10

function within(at: number, spans: readonly Span[]): boolean {
  return spans.some(([from, to]) => at >= from && at < to)
}

/** Bands of pavement, roadway and pavement, one per width, with a block between them. */
function axis(widths: readonly number[]): Axis {
  const pave = METRICS.road.street.pavementCells
  const road: Span[] = []
  const pavement: Span[] = []
  let at = BLOCK
  for (const width of widths) {
    pavement.push([at, at + pave])
    road.push([at + pave, at + pave + width])
    pavement.push([at + pave + width, at + pave * 2 + width])
    at += pave * 2 + width + BLOCK
  }
  return { road, pavement, length: at }
}

const WIDTHS = {
  x: [METRICS.road.street.roadwayCells, METRICS.road.avenue.roadwayCells, METRICS.road.street.roadwayCells],
  y: [METRICS.road.street.roadwayCells, METRICS.road.exit.roadwayCells, METRICS.road.street.roadwayCells],
}

/**
 * A town whose roads are the classes a real city has: ordinary streets, an
 * avenue across it and the road out of the valley down it, each at its own
 * width with a pavement either side. A crossing index that measures itself
 * against one class finds the streets and quietly misses the rest, which is
 * what this town is for.
 */
export function classTown(seed = 'crowd-classes'): { world: World; atCrossing: (x: number, y: number) => boolean; widthAt: (x: number, y: number) => number } {
  const across = axis(WIDTHS.x)
  const down = axis(WIDTHS.y)
  const world = World.create({ name: 'Classes', theme: 'test', seed, width: across.length, height: down.length })

  for (let y = 0; y < down.length; y++) {
    for (let x = 0; x < across.length; x++) {
      const road = within(x, across.road) || within(y, down.road)
      const pavement = within(x, across.pavement) || within(y, down.pavement)
      if (road) world.paint({ x, y, w: 1, h: 1 }, 'street')
      else if (pavement) world.paint({ x, y, w: 1, h: 1 }, 'sidewalk')
    }
  }

  const atCrossing = (x: number, y: number): boolean =>
    (within(y, down.pavement) && within(x, across.road)) || (within(x, across.pavement) && within(y, down.road))
  const widthAt = (x: number, y: number): number => spanOf(x, across.road) ?? spanOf(y, down.road) ?? 0
  return { world, atCrossing, widthAt }
}

/** How wide the band this cell falls in is, in cells, or nothing when it is in none. */
function spanOf(at: number, spans: readonly Span[]): number | undefined {
  const band = spans.find(([from, to]) => at >= from && at < to)
  return band ? band[1] - band[0] : undefined
}

/**
 * Pavement, a roadway wider than any crossing in the city, then pavement again.
 * A route over it is one the crossing mender cannot fix, so somebody walking it
 * is walking the length of a road with no far kerb anywhere within reach.
 */
export function wideRoad(seed = 'crowd-wide-road'): World {
  const road = WIDEST_ROADWAY_CELLS + 3
  const pave = 8
  const world = World.create({ name: 'Wide', theme: 'test', seed, width: pave * 2 + road, height: 4 })
  world.paint({ x: 0, y: 1, w: pave, h: 1 }, 'sidewalk')
  world.paint({ x: pave, y: 1, w: road, h: 1 }, 'street')
  world.paint({ x: pave + road, y: 1, w: pave, h: 1 }, 'sidewalk')
  return world
}

/**
 * One room behind a plot's door, so a companion has somewhere to be taken
 * into. The rooms are `@gb/world`'s business; the crowd only needs the
 * interior to name its plot.
 */
export function roomBehind(world: World, plotId: string): string {
  const id = world.mintId('interior')
  const room = world.mintId('room')
  const added = world.addInterior({
    id,
    plotId,
    kind: world.plot(plotId)!.kind,
    size: { w: 8, h: 6 },
    rooms: [{ id: room, kind: 'main', name: 'Front room', rect: { x: 0, y: 0, w: 8, h: 6 } }],
    doors: [{ id: world.mintId('door'), from: 'outside', to: room, pos: { x: 4, y: 0 }, rot: 0 }],
    furniture: [],
    anchors: [],
  })
  if (!added.ok) throw new Error(`test town could not build a room: ${added.error.code}`)
  return id
}
