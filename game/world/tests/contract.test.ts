import { describe, expect, it } from 'vitest'
import {
  METRICS,
  questView,
  ROAD_KINDS,
  WIDEST_ROADWAY_CELLS,
  World,
  type Interior,
  type Item,
  type Npc,
  type Placement,
} from '../src/index.ts'

/** A two-street hamlet with one bar, its interior, its bartender and a bottle. */
function hamlet() {
  const world = World.create({ name: 'Dry Gulch', theme: 'western', seed: 'test-1', width: 16, height: 16 })
  world.paint({ x: 0, y: 6, w: 16, h: 2 }, 'street')
  world.paint({ x: 0, y: 5, w: 16, h: 1 }, 'sidewalk')
  world.paint({ x: 0, y: 8, w: 16, h: 1 }, 'sidewalk')

  const plot = world.addPlot({
    kind: 'bar',
    name: 'The Rusty Nail',
    rect: { x: 2, y: 1, w: 4, h: 4 },
    entrance: { cell: { x: 3, y: 5 }, facing: 'south' },
    storeys: 1,
    style: 'western-timber',
  })
  if (!plot.ok) throw new Error(JSON.stringify(plot.error))

  const interior: Interior = {
    id: world.mintId('interior'),
    plotId: plot.value.id,
    kind: 'bar',
    size: { w: 8, h: 8 },
    rooms: [{ id: world.mintId('room'), kind: 'main', name: 'Saloon', rect: { x: 0, y: 0, w: 8, h: 8 } }],
    doors: [],
    furniture: [],
    anchors: [],
  }
  const roomId = interior.rooms[0]!.id
  const counterId = world.mintId('prop')
  interior.doors.push({ id: world.mintId('door'), from: 'outside', to: roomId, pos: { x: 4, y: 0 }, rot: 180, locked: false })
  interior.furniture.push({ id: counterId, prop: 'bar-counter', roomId, pos: { x: 4, y: 6 }, rot: 0 })
  interior.anchors.push({ id: world.mintId('anchor'), kind: 'serve', roomId, pos: { x: 4, y: 7 }, rot: 180, propId: counterId })
  interior.anchors.push({ id: world.mintId('anchor'), kind: 'sit-drink', roomId, pos: { x: 3, y: 5 }, rot: 0, propId: counterId })
  const added = world.addInterior(interior)
  expect(added.ok).toBe(true)

  const bartender: Npc = {
    id: world.mintId('npc'),
    name: 'Mara Cole',
    role: 'bartender',
    appearance: { base: 'female', variant: 3 },
    station: { interiorId: interior.id, anchorId: interior.anchors[0]!.id },
    workPlotId: plot.value.id,
    personality: 'Dry, unhurried, remembers every face that ever stiffed her on a tab.',
    knowledge: ['The stage road washes out after rain.', 'Old Hollis owes the bar nine dollars.'],
  }
  expect(world.addNpc(bartender).ok).toBe(true)

  const bottle: Item = {
    id: world.mintId('item'),
    name: 'Dusty Whiskey Bottle',
    description: 'Half full, label worn to nothing.',
    archetype: 'bottle',
    value: 4,
    bulk: 'pocket',
    ownerNpcId: bartender.id,
  }
  const placement: Placement = { at: 'anchor', itemId: bottle.id, interiorId: interior.id, anchorId: interior.anchors[0]!.id }
  expect(world.addItem(bottle, placement).ok).toBe(true)

  return { world, plot: plot.value, interior, bartender, bottle }
}

describe('World', () => {
  it('builds a sound city and survives a round trip through JSON', () => {
    const { world, plot, bartender } = hamlet()
    expect(world.check()).toEqual([])

    const reloaded = World.load(JSON.parse(JSON.stringify(world.toJSON())))
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return

    const copy = reloaded.value
    expect(copy.name).toBe('Dry Gulch')
    expect(copy.plot(plot.id)?.name).toBe('The Rusty Nail')
    expect(copy.npcsIn(plot.id).map((n) => n.name)).toEqual(['Mara Cole'])
    expect(copy.plotsOfKind('bar')).toHaveLength(1)
    expect(copy.positionOf(bartender.id)).toEqual(copy.positionOf(plot.id))
    // ids keep counting where the first session left off
    expect(copy.mintId('npc')).toBe('npc_0002')
  })

  it('offers empty land next to a sidewalk so a city can grow later', () => {
    const { world } = hamlet()
    const sites = world.buildSites(3, 3)
    expect(sites.length).toBeGreaterThan(0)

    const before = world.plots().length
    const added = world.addPlot({
      kind: 'house',
      name: 'Hollis Place',
      rect: sites[0]!,
      entrance: { cell: { x: sites[0]!.x, y: sites[0]!.y + sites[0]!.h }, facing: 'south' },
      storeys: 1,
      style: 'western-timber',
    })
    expect(added.ok).toBe(true)
    expect(world.plots()).toHaveLength(before + 1)
    expect(world.check()).toEqual([])

    // the same ground is no longer on offer
    expect(world.buildSites(3, 3)).not.toContainEqual(sites[0])
  })

  it('refuses a footprint that is already taken', () => {
    const { world, plot } = hamlet()
    const clash = world.addPlot({
      kind: 'house',
      name: 'On Top Of The Bar',
      rect: plot.rect,
      entrance: { cell: { x: plot.rect.x, y: plot.rect.y + plot.rect.h }, facing: 'south' },
      storeys: 1,
      style: 'western-timber',
    })
    expect(clash.ok).toBe(false)
    if (!clash.ok) expect(clash.error.code).toBe('no-space')
  })

  it('keeps the two working stances apart and refuses a third nobody can animate', () => {
    const { world, interior } = hamlet()
    const roomId = interior.rooms[0]!.id
    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    const anchors = doc.interiors[0].anchors as Array<Record<string, unknown>>
    anchors.push({ id: 'anchor_9001', kind: 'work-desk', roomId, pos: { x: 1, y: 1 }, rot: 0 })
    anchors.push({ id: 'anchor_9002', kind: 'work-bench', roomId, pos: { x: 2, y: 1 }, rot: 0 })
    expect(World.load(JSON.parse(JSON.stringify(doc))).ok).toBe(true)

    anchors.push({ id: 'anchor_9003', kind: 'work-standing', roomId, pos: { x: 3, y: 1 }, rot: 0 })
    const refused = World.load(doc)
    expect(refused.ok).toBe(false)
    if (!refused.ok && refused.error.code === 'invalid-document') {
      expect(refused.error.violations.some((v) => v.path.endsWith('anchors.4.kind'))).toBe(true)
    } else {
      throw new Error('expected invalid-document')
    }
  })

  it('carries a piece standing on another piece, and refuses one over the ceiling', () => {
    const { world, interior } = hamlet()
    const roomId = interior.rooms[0]!.id
    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    const furniture = doc.interiors[0].furniture as Array<Record<string, unknown>>
    const till: Record<string, unknown> = { id: 'prop_9001', prop: 'register', roomId, pos: { x: 4, y: 6 }, rot: 0, lift: METRICS.furniture.barCounterHeight }
    furniture.push(till)

    const loaded = World.load(JSON.parse(JSON.stringify(doc)))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.check()).toEqual([])
    // and it is still on the counter when the city is saved and shared
    const saved = loaded.value.toJSON()
    expect(saved.interiors[0]!.furniture.at(-1)!.lift).toBe(METRICS.furniture.barCounterHeight)
    expect(saved.interiors[0]!.furniture[0]!.lift).toBeUndefined()

    till.lift = METRICS.building.groundFloorHeight + 0.5
    const refused = World.load(doc)
    expect(refused.ok).toBe(false)
    if (!refused.ok && refused.error.code === 'invalid-document') {
      expect(refused.error.violations.some((v) => v.path.endsWith('furniture.1.lift'))).toBe(true)
    } else {
      throw new Error('expected invalid-document')
    }
  })

  it('rejects a document that breaks the schema', () => {
    const { world } = hamlet()
    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    doc.plots[0].storeys = 0
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok && loaded.error.code === 'invalid-document') {
      expect(loaded.error.violations[0]?.path).toContain('plots.0.storeys')
    } else {
      throw new Error('expected invalid-document')
    }
  })

  it('rejects a document that is schema-valid but does not hold together', () => {
    const { world, bartender } = hamlet()
    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    doc.npcs[0].station.anchorId = 'anchor_9999'
    doc.items[0].ownerNpcId = 'npc_9999'

    const loaded = World.load(doc)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok && loaded.error.code === 'inconsistent-world') {
      const messages = loaded.error.problems.map((p) => `${p.where}: ${p.message}`)
      expect(messages.some((m) => m.includes(bartender.id) && m.includes('anchor_9999'))).toBe(true)
      expect(messages.some((m) => m.includes('npc_9999'))).toBe(true)
    } else {
      throw new Error('expected inconsistent-world')
    }
  })

  it('catches a plot drawn somewhere the grid does not agree with', () => {
    const { world } = hamlet()
    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    doc.plots[0].rect = { x: 10, y: 10, w: 3, h: 3 } // empty land, not marked as building
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok && loaded.error.code === 'inconsistent-world') {
      expect(loaded.error.problems.some((p) => p.message.includes('not marked as building'))).toBe(true)
    } else {
      throw new Error('expected inconsistent-world')
    }
  })
})

describe('road widths', () => {
  it('gives every class of road its own width, and takes one of each into a document', () => {
    const world = World.create({ name: 'Wide', theme: 'test', seed: 'roads', width: 40, height: 40 })
    const nodes = ROAD_KINDS.map((_, i) => ({ id: world.mintId('node'), cell: { x: 4 + i * 8, y: 8 } }))
    world.addRoad(
      nodes,
      ROAD_KINDS.map((kind, i) => ({
        id: world.mintId('road'),
        from: nodes[i]!.id,
        to: nodes[(i + 1) % nodes.length]!.id,
        kind,
        lanes: METRICS.road[kind].lanes,
      })),
    )
    const reloaded = World.load(JSON.parse(JSON.stringify(world.toJSON())))
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    expect(reloaded.value.toJSON().roads.segments.map((s) => s.kind)).toEqual([...ROAD_KINDS])

    // a street is not an avenue is not the road out: three classes, three widths
    const widths = ROAD_KINDS.map((kind) => METRICS.road[kind].roadwayCells)
    expect(new Set(widths).size).toBe(ROAD_KINDS.length)
    expect(METRICS.road.avenue.roadwayCells).toBeGreaterThan(METRICS.road.street.roadwayCells)
    expect(METRICS.road.avenue.lanes).toBe(4)
  })

  it('keeps every roadway an odd number of cells, so a centreline is a line of cell centres', () => {
    // a junction node sits on a cell, and a car drives the middle of its half of
    // the road: an even roadway puts both half a cell out
    for (const kind of ROAD_KINDS) {
      const { roadwayCells, pavementCells } = METRICS.road[kind]
      expect(roadwayCells % 2, kind).toBe(1)
      expect(pavementCells, kind).toBeGreaterThan(0)
    }
    expect(WIDEST_ROADWAY_CELLS).toBe(Math.max(...ROAD_KINDS.map((kind) => METRICS.road[kind].roadwayCells)))
    expect(METRICS.street.roadwayCells).toBe(METRICS.road.street.roadwayCells)
  })
})

describe('questView', () => {
  it('answers the five questions the quest layer asks, and only about things that exist', () => {
    const { world, plot, interior, bartender, bottle } = hamlet()
    const view = questView(world)

    expect(view.hasPlot(plot.id)).toBe(true)
    expect(view.hasPlot('plot_9999')).toBe(false)

    expect(view.hasInterior(interior.id)).toBe(true)
    expect(view.hasInterior('interior_9999')).toBe(false)

    expect(view.hasNpc(bartender.id)).toBe(true)
    expect(view.hasNpc('npc_9999')).toBe(false)

    expect(view.hasItem(bottle.id)).toBe(true)
    expect(view.hasItem('item_9999')).toBe(false)

    const serve = interior.anchors[0]!.id
    expect(view.hasAnchor(interior.id, serve)).toBe(true)
    expect(view.hasAnchor(interior.id, 'anchor_9999')).toBe(false)
    // an anchor that exists, but not in the interior asked about
    expect(view.hasAnchor('interior_9999', serve)).toBe(false)
  })
})

describe('founding a city', () => {
  const spec = { name: 'Dry Gulch', theme: 'western', seed: 'test-1', width: 16, height: 16 }

  it('hands back an empty city the loader accepts', () => {
    const made = World.found(spec)
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.grid.width).toBe(16)
    expect(World.load(JSON.parse(JSON.stringify(made.value.toJSON()))).ok).toBe(true)
  })

  it('refuses a grid too big to validate, instead of building one', () => {
    const made = World.found({ ...spec, width: 1093 })
    expect(made.ok).toBe(false)
    if (made.ok || made.error.code !== 'invalid-document') throw new Error('expected invalid-document')
    expect(made.error.violations.map((v) => v.path)).toContain('width')
  })

  it('refuses a theme longer than a world may carry', () => {
    const made = World.found({ ...spec, theme: 'a'.repeat(200) })
    expect(made.ok).toBe(false)
    if (made.ok || made.error.code !== 'invalid-document') throw new Error('expected invalid-document')
    expect(made.error.violations.map((v) => v.path)).toContain('theme')
  })

  it('refuses the same specs through the older create', () => {
    expect(() => World.create({ ...spec, width: 1093 })).toThrow(/width/)
    expect(() => World.create({ ...spec, theme: 'a'.repeat(200) })).toThrow(/theme/)
    expect(World.create(spec).name).toBe('Dry Gulch')
  })
})
