import { Forge } from '@gb/forge'
import type { Result } from '@gb/kit'
import { rewardFor, type QuestDoc } from '@gb/quest'
import { World, type Facing, type Rect } from '@gb/world'

/**
 * The cities these tests run on.
 *
 * Every word a real city carries is written by a model, and this box is about
 * the file a city travels in rather than the words inside it: what has to hold
 * is that a document seals, opens, packs and reconciles. So a town here is laid
 * out by arithmetic (`@gb/forge`'s `Forge.plan`, which asks nobody anything)
 * and grown by hand, record by record, the way `Forge.extend` appends them.
 * Both halves are data.
 */

/** Frontage and depth of every building a growth puts up, in cells: inside `@gb/world`'s `PLOT_BAND`. */
const FOOTPRINT = { w: 4, h: 5 }

/** What one building a growth put up holds, by id. */
export interface Raised {
  readonly plotId: string
  readonly interiorId: string
  readonly anchorIds: readonly string[]
  readonly npcIds: readonly string[]
  readonly itemIds: readonly string[]
}

/** How much a growth puts in each building it opens. One person needs one anchor to stand on. */
export interface Has {
  readonly anchors?: number
  readonly people?: number
  readonly things?: number
}

/** The architecture of a town: streets, roads, the parts of it and every building, all named by placeholder. */
export function laidOut(seed: string, brief: { blocks?: number; blockCells?: number; density?: number } = {}): World {
  const planned = Forge.plan({
    theme: 'harbour town',
    seed,
    blocksX: brief.blocks ?? 2,
    blocksY: brief.blocks ?? 2,
    ...(brief.blockCells === undefined ? {} : { blockCells: brief.blockCells }),
    density: brief.density ?? 0.5,
  })
  if (!planned.ok) throw new Error(`no plan for ${seed}: ${JSON.stringify(planned.error).slice(0, 300)}`)
  return planned.value
}

/**
 * Puts `buildings` more up on ground nothing has claimed, each with its door
 * open, people standing in it and things lying about. This is the shape of what
 * `Forge.extend` appends to a finished city: new plots, new interiors, new
 * people, new things, and empty ground turned into building.
 */
export function grow(world: World, buildings: number, has: Has = {}): Raised[] {
  return ground(world, buildings).map((rect) => raise(world, rect, has))
}

/**
 * A side job over one of those buildings: pick the thing up, put it back where
 * it lives, say it is done. The smallest flow `@gb/quest` accepts, so a test
 * that carries a quest through a file carries one the runtime would run.
 */
export function errand(id: string, title: string, place: Raised, itemId: string = place.itemIds[0]!): QuestDoc {
  return {
    format: 'game-box.quest',
    schemaVersion: 1,
    id,
    kind: 'side',
    title,
    summary: 'Something was left lying about and wants stowing where it belongs.',
    giverNpcId: place.npcIds[0]!,
    difficulty: 'errand',
    startStepId: 'step_0001',
    steps: [
      { id: 'step_0001', objective: 'Pick it up', kind: 'collect', itemId, allowSteal: true, next: ['step_0002'], requires: [], effects: [] },
      {
        id: 'step_0002',
        objective: 'Stow it where it lives',
        kind: 'stash',
        itemId,
        interiorId: place.interiorId,
        anchorId: place.anchorIds[0]!,
        next: ['step_0003'],
        requires: [],
        effects: [],
      },
      { id: 'step_0003', objective: 'Say it is done', kind: 'complete', next: [], requires: [], effects: [] },
    ],
    reward: rewardFor('errand'),
  }
}

/** Free footprints that do not overlap, off one scan of the ground: where a growth goes. */
function ground(world: World, count: number): Rect[] {
  const taken: Rect[] = []
  for (const rect of world.buildSites(FOOTPRINT.w, FOOTPRINT.h)) {
    if (taken.length === count) break
    if (taken.every((one) => apart(one, rect))) taken.push(rect)
  }
  if (taken.length < count) throw new Error(`the town has room for ${taken.length} more buildings, not ${count}`)
  return taken
}

const apart = (a: Rect, b: Rect) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y

/** One building, its inside, its people and its stock, all under the placeholder names a plan carries. */
function raise(world: World, rect: Rect, has: Has): Raised {
  const anchorCount = has.anchors ?? Math.max(has.people ?? 0, 1)
  if ((has.people ?? 0) > anchorCount) throw new Error('two people cannot stand on one anchor')

  const plot = unwrap(
    world.addPlot({
      kind: 'house',
      name: `Instance ${world.plots().length + 1}`,
      rect,
      storeys: 2,
      entrance: doorOnto(world, rect),
      style: 'harbour-house',
    }),
    'the plot',
  )

  const interiorId = world.mintId('interior')
  const roomId = world.mintId('room')
  const anchorIds = Array.from({ length: anchorCount }, () => world.mintId('anchor'))
  unwrap(
    world.addInterior({
      id: interiorId,
      plotId: plot.id,
      kind: plot.kind,
      size: { w: 6, h: 6 },
      // the use is written here rather than left to be read back off the label,
      // so the document already describes itself and packing it changes nothing
      rooms: [{ id: roomId, kind: 'main', use: 'living-room', name: 'Room 1', rect: { x: 0, y: 0, w: 6, h: 6 } }],
      doors: [{ id: world.mintId('door'), from: 'outside', to: roomId, pos: { x: 3, y: 0 }, rot: 0, locked: false }],
      furniture: [],
      anchors: anchorIds.map((id, at) => ({ id, kind: 'stand' as const, roomId, pos: { x: 1, y: 1 + at }, rot: 0 })),
    }),
    'the interior',
  )

  const npcIds = Array.from({ length: has.people ?? 0 }, (_, at) =>
    unwrap(
      world.addNpc({
        id: world.mintId('npc'),
        name: `Person ${world.npcs().length + 1}`,
        role: 'resident',
        appearance: { base: 'female', variant: 0 },
        station: { interiorId, anchorId: anchorIds[at]! },
        workPlotId: plot.id,
        personality: 'Stands where the plan put them.',
        knowledge: [],
      }),
      'a person',
    ).id,
  )

  const itemIds = Array.from({ length: has.things ?? 0 }, () => {
    const id = world.mintId('item')
    const item = { id, name: `Thing ${world.items().length + 1}`, description: 'Something lying about.', archetype: 'box' as const }
    return unwrap(world.addItem(item, { at: 'anchor', itemId: id, interiorId, anchorId: anchorIds[0]! }), 'a thing').id
  })

  return { plotId: plot.id, interiorId, anchorIds, npcIds, itemIds }
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

function unwrap<T>(result: Result<T, unknown>, what: string): T {
  if (!result.ok) throw new Error(`${what}: ${JSON.stringify(result.error).slice(0, 300)}`)
  return result.value
}
