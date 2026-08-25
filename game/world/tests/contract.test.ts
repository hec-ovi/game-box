import { describe, expect, it } from 'vitest'
import {
  ANCHOR_KINDS,
  BODY_KINDS,
  CELL_KINDS,
  FURNITURE_PROPS,
  footprintOf,
  inPlotBand,
  MAX_BACKGROUND_FACTS,
  METRICS,
  PLOT_BAND,
  plotShape,
  PROP_CELL,
  PROP_SPECS,
  questView,
  ROAD_KINDS,
  WIDEST_ROADWAY_CELLS,
  World,
  type Asks,
  type Interior,
  type Item,
  type Npc,
  type Placement,
  type Premise,
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

describe('what a city was designed against', () => {
  const catalogue = { pack: 'gb-prefab', version: '1.2.0', sha256: 'a'.repeat(64) }
  const design = { pack: 'gb-prefab', model: 'corner-tower-03', mirror: true, rooms: 5 }

  it('pins the building a plot got, and hands it back after a save and a load', () => {
    const { world, plot } = hamlet()
    expect(world.recordCatalogues([catalogue]).ok).toBe(true)
    expect(world.recordDesign(plot.id, design).ok).toBe(true)

    const reloaded = World.load(JSON.parse(JSON.stringify(world.toJSON())))
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    expect(reloaded.value.check()).toEqual([])
    // the same model, the same way round, in the same place: nothing re-picked it
    expect(reloaded.value.plot(plot.id)?.design).toEqual(design)
    expect(reloaded.value.catalogues()).toEqual([catalogue])
  })

  it('takes a design on a plot added later, so a pack pins its own buildings', () => {
    const { world } = hamlet()
    expect(world.recordCatalogues([catalogue]).ok).toBe(true)
    const site = world.buildSites(3, 3)[0]!
    const added = world.addPlot({
      kind: 'house',
      name: 'Hollis Place',
      rect: site,
      entrance: { cell: { x: site.x, y: site.y + site.h }, facing: 'south' },
      storeys: 1,
      style: 'western-timber',
      design,
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.value.design).toEqual(design)
    expect(world.check()).toEqual([])
  })

  it('refuses a design against a catalogue the city does not name, whichever door it comes through', () => {
    const { world, plot } = hamlet()
    const refused = world.recordDesign(plot.id, design)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.code).toBe('unknown-reference')

    // a plot added with a design of its own is held to the same list
    const site = world.buildSites(3, 3)[0]!
    const added = world.addPlot({
      kind: 'house',
      name: 'Hollis Place',
      rect: site,
      entrance: { cell: { x: site.x, y: site.y + site.h }, facing: 'south' },
      storeys: 1,
      style: 'western-timber',
      design,
    })
    expect(added.ok).toBe(false)
    if (!added.ok) expect(added.error.code).toBe('unknown-reference')
    // and it refused before it took the ground
    expect(world.buildSites(3, 3)).toContainEqual(site)

    // and a list that drops a catalogue plots are already pinned to
    expect(world.recordCatalogues([catalogue]).ok).toBe(true)
    expect(world.recordDesign(plot.id, design).ok).toBe(true)
    const dropped = world.recordCatalogues([{ pack: 'other-pack', version: '1.0.0' }])
    expect(dropped.ok).toBe(false)
    if (!dropped.ok) expect(dropped.error.code).toBe('unknown-reference')

    // and the same dangling reference in a document somebody else wrote
    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    doc.catalogues = [{ ...catalogue, pack: 'some-other-pack' }]
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok && loaded.error.code === 'inconsistent-world') {
      expect(loaded.error.problems.some((p) => p.message.includes('gb-prefab'))).toBe(true)
    } else {
      throw new Error('expected inconsistent-world')
    }
  })

  it('catches an interior its plot does not point back at, so interiorId is every door that opens', () => {
    const { world } = hamlet()
    const doc = JSON.parse(JSON.stringify(world.toJSON()))
    delete doc.plots[0].interiorId
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok && loaded.error.code === 'inconsistent-world') {
      expect(loaded.error.problems.some((p) => p.message.includes('does not point back'))).toBe(true)
    } else {
      throw new Error('expected inconsistent-world')
    }
  })
})

describe('the history a city was built against', () => {
  const premise: Premise = {
    livesOn: 'The stack of fabrication floors under the ring road.',
    happened: 'A coolant line let go and took the night shift with it.',
    stake: 'Who pays to restart the line, and who gets the floor space if nobody does.',
    sides: [
      { name: 'Halvorsen Fabrication', wants: 'the floors back on shift by winter' },
      { name: 'The night-shift widows', wants: 'the line named and the coolant contract torn up' },
    ],
    common: ['Nobody works the fourth floor any more.'],
    build: { moreOf: ['workshop'], fewerOf: ['office'], mustHave: ['clinic'] },
  }

  it('keeps the history in the file, so a city that is grown later is grown against it', () => {
    const made = World.found({ name: 'Halvorsen', theme: 'industrial', seed: 'p1', width: 16, height: 16, premise })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.premise()).toEqual(premise)

    const reloaded = World.load(JSON.parse(JSON.stringify(made.value.toJSON())))
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    expect(reloaded.value.premise()).toEqual(premise)
    expect(reloaded.value.check()).toEqual([])
  })

  it('leaves a city founded without one alone', () => {
    const made = World.found({ name: 'Nowhere', theme: 'plain', seed: 'p2', width: 16, height: 16 })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.premise()).toBeUndefined()
    expect('premise' in made.value.toJSON()).toBe(false)
  })

  it('takes any word the history asks for, and refuses what is not a word', () => {
    const spec = { name: 'Halvorsen', theme: 'industrial', seed: 'p3', width: 16, height: 16 }
    const asked = World.found({ ...spec, premise: { ...premise, build: { ...premise.build, mustHave: ['jail'] } } })
    expect(asked.ok).toBe(true)
    if (asked.ok) expect(asked.value.premise()?.build.mustHave).toEqual(['jail'])

    const made = World.found({ ...spec, premise: { ...premise, build: { ...premise.build, mustHave: ['Space Port'] } } })
    expect(made.ok).toBe(false)
    if (made.ok || made.error.code !== 'invalid-document') throw new Error('expected invalid-document')
    expect(made.error.violations.map((v) => v.path).join(' ')).toContain('mustHave')
  })

  it('refuses a town with only one side to its argument, whichever door it comes through', () => {
    const oneSided = { ...premise, sides: [premise.sides[0]!] }
    const made = World.found({ name: 'Halvorsen', theme: 'industrial', seed: 'p4', width: 16, height: 16, premise: oneSided as never })
    expect(made.ok).toBe(false)

    const doc = JSON.parse(JSON.stringify(World.create({ name: 'H', theme: 't', seed: 'p5', width: 16, height: 16 }).toJSON()))
    doc.premise = oneSided
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(false)
    if (loaded.ok || loaded.error.code !== 'invalid-document') throw new Error('expected invalid-document')
    expect(loaded.error.violations.map((v) => v.path).join(' ')).toContain('premise.sides')
  })
})

describe('the heights a body is animated against', () => {
  const { reach, furniture } = METRICS

  it('puts every surface a body works at inside the reach of the stance that works there', () => {
    // a cook's hands rode 7 cm over a 0.9 m hob because nothing measured the
    // number against the clip that reaches for it
    const standing = [furniture.barCounterHeight, furniture.serviceCounterHeight, furniture.worktopHeight]
    for (const height of standing) {
      expect(height, `standing work surface ${height}`).toBeGreaterThanOrEqual(reach.standing.palm)
      expect(height, `standing work surface ${height}`).toBeLessThanOrEqual(reach.standing.wrist)
    }
    expect(furniture.tableHeight).toBeGreaterThanOrEqual(reach.seated.palm)
    expect(furniture.tableHeight).toBeLessThanOrEqual(reach.seated.wrist)
  })

  it('puts a seat pad under the body that sits on it, not above it', () => {
    // a pad above the body's own underside leaves it floating; below it, the
    // pad gives, which is what a cushion does
    expect(furniture.seatHeight).toBeGreaterThanOrEqual(reach.seatContact)
    expect(furniture.seatHeight - reach.seatContact).toBeLessThanOrEqual(reach.padGive)
    // the stool clip carries its own height: hips on the pad, soles on the rail under it
    expect(furniture.stoolHeight).toBeGreaterThanOrEqual(reach.stoolContact)
    expect(furniture.stoolHeight - reach.stoolContact).toBeLessThanOrEqual(reach.padGive)
    expect(reach.stoolSoles).toBeLessThan(reach.stoolContact)
  })
})

/** The document of a hamlet, as JSON, for a test that edits it by hand. */
function docOf(world: World): Record<string, any> {
  return JSON.parse(JSON.stringify(world.toJSON()))
}

function violationsOf(loaded: ReturnType<typeof World.load>): string[] {
  if (loaded.ok || loaded.error.code !== 'invalid-document') throw new Error('expected invalid-document')
  return loaded.error.violations.map((v) => v.path)
}

function problemsOf(loaded: ReturnType<typeof World.load>): string[] {
  if (loaded.ok || loaded.error.code !== 'inconsistent-world') throw new Error('expected inconsistent-world')
  return loaded.error.problems.map((p) => p.message)
}

describe('the bodies and the stances', () => {
  it('takes a person on either shipped body dancing, and refuses a build the pack does not hold', () => {
    const { world, interior } = hamlet()
    const doc = docOf(world)
    const roomId = interior.rooms[0]!.id
    doc.interiors[0].anchors.push({ id: 'anchor_9001', kind: 'dance', roomId, pos: { x: 2, y: 2 }, rot: 0 })
    const dancer = {
      id: 'npc_9001',
      name: 'Bo',
      role: 'patron',
      appearance: { base: 'male', variant: 0 },
      station: { interiorId: interior.id, anchorId: 'anchor_9001' },
      personality: 'Never stops moving.',
      knowledge: [],
    }
    doc.npcs.push(dancer)
    expect(World.load(JSON.parse(JSON.stringify(doc))).ok).toBe(true)
    expect(BODY_KINDS).toEqual(['male', 'female'])
    expect(ANCHOR_KINDS).toContain('dance')

    dancer.appearance.base = 'hero-male'
    expect(violationsOf(World.load(doc))).toContain('npcs.1.appearance.base')
  })
})

describe('the cells a city is laid in', () => {
  it('reads every kind back off the grid, and refuses a char outside the vocabulary', () => {
    const { world } = hamlet()
    CELL_KINDS.forEach((kind, x) => world.grid.set(x, 15, kind))
    expect(CELL_KINDS.map((_, x) => world.grid.at(x, 15))).toEqual([...CELL_KINDS])
    expect(World.load(docOf(world)).ok).toBe(true)

    const doc = docOf(world)
    doc.grid.rows[15] = `?${doc.grid.rows[15].slice(1)}`
    expect(problemsOf(World.load(doc))).toContainEqual(expect.stringContaining('unknown cell char "?"'))
  })
})

describe('a piece standing on another piece', () => {
  const till = (counterId: string, roomId: string) => ({
    id: 'prop_9001',
    prop: 'register',
    roomId,
    pos: { x: 4, y: 6 },
    rot: 0,
    lift: METRICS.furniture.serviceCounterHeight,
    on: counterId,
  })

  it('names its host and keeps it through a save', () => {
    const { world, interior } = hamlet()
    const doc = docOf(world)
    doc.interiors[0].furniture.push(till(interior.furniture[0]!.id, interior.rooms[0]!.id))
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.toJSON().interiors[0]!.furniture.at(-1)!.on).toBe(interior.furniture[0]!.id)
  })

  it('refuses a host that is not in the room, itself, or a host with no lift', () => {
    const { world, interior } = hamlet()
    const roomId = interior.rooms[0]!.id
    const counterId = interior.furniture[0]!.id

    const stray = docOf(world)
    stray.interiors[0].furniture.push(till('prop_9999', roomId))
    expect(problemsOf(World.load(stray)).some((m) => m.includes('unknown prop prop_9999'))).toBe(true)

    const itself = docOf(world)
    itself.interiors[0].furniture.push(till('prop_9001', roomId))
    expect(problemsOf(World.load(itself)).some((m) => m.includes('stands on itself'))).toBe(true)

    const grounded = docOf(world)
    const { lift: _lift, ...noLift } = till(counterId, roomId)
    grounded.interiors[0].furniture.push(noLift)
    expect(problemsOf(World.load(grounded)).some((m) => m.includes('with no lift'))).toBe(true)
  })
})

describe('what a thing is worth', () => {
  it('reads a thing with no price as worth nothing, so an older file still opens', () => {
    const { world } = hamlet()
    const doc = docOf(world)
    delete doc.items[0].value
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.items()[0]!.value).toBe(0)
  })

  it('refuses a price that is not whole credits', () => {
    const { world } = hamlet()
    const doc = docOf(world)
    doc.items[0].value = 4.5
    expect(violationsOf(World.load(doc))).toContain('items.0.value')
    doc.items[0].value = -1
    expect(violationsOf(World.load(doc))).toContain('items.0.value')
  })
})

describe('what the owner asked for', () => {
  const brief = 'A port town that sold its harbour to the wrong people and wants it back. Long, in his own words. '.repeat(40)
  const asks: Asks = {
    mainQuest: 'Get the harbour deeds back from whoever holds them now.',
    sideQuests: 'Small favours between neighbours, nothing with guns.',
    tone: 'Tired, wet, funny in the way people are at three in the morning.',
    style: { neon: 'lit', density: 'dense', wear: 'run-down' },
  }

  it('keeps the brief and the asks in the file, unbounded, and hands them back', () => {
    const made = World.found({ name: 'Wetmouth', theme: 'harbour', seed: 'a1', width: 16, height: 16, brief, asks })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.brief()).toBe(brief)
    expect(made.value.asks()).toEqual(asks)

    const reloaded = World.load(docOf(made.value))
    expect(reloaded.ok).toBe(true)
    if (!reloaded.ok) return
    expect(reloaded.value.brief()).toBe(brief)
    expect(reloaded.value.asks()).toEqual(asks)
  })

  it('leaves a city founded with only a theme alone', () => {
    const made = World.found({ name: 'Plain', theme: 'plain', seed: 'a2', width: 16, height: 16 })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.brief()).toBeUndefined()
    expect(made.value.asks()).toBeUndefined()
    expect('brief' in made.value.toJSON()).toBe(false)
    expect('asks' in made.value.toJSON()).toBe(false)
  })

  it('refuses a style the catalogue cannot draw, whichever door it comes through', () => {
    const medieval = { style: { period: 'medieval', neon: 'candles' } }
    const spec = { name: 'Wetmouth', theme: 'harbour', seed: 'a3', width: 16, height: 16 }
    const made = World.found({ ...spec, asks: medieval as never })
    expect(made.ok).toBe(false)
    if (made.ok || made.error.code !== 'invalid-document') throw new Error('expected invalid-document')
    expect(made.error.violations.map((v) => v.path)).toContain('asks.style.neon')

    const doc = docOf(World.create(spec))
    doc.asks = medieval
    expect(violationsOf(World.load(doc))).toContain('asks.style.neon')
  })
})

describe("a person's life and what the player earns of it", () => {
  const life = {
    history: 'Came down from the ridge farms when the coolant line went.',
    interests: 'Engines, other people\'s debts.',
    manner: 'Short sentences, never a question.',
    cares: 'Her brother on the night shift.',
    avoids: 'The fire.',
    reason: 'It is her shift, and the shift is short-handed.',
  }
  const background = [
    { fact: 'She was on the night shift the night the line went.', unlockedBy: 'talked' },
    { fact: 'Halvorsen paid her to stay quiet about it.', unlockedBy: 'quest' },
  ]

  it('carries a life and staged facts, and hands them back untouched', () => {
    const { world } = hamlet()
    const doc = docOf(world)
    doc.npcs[0].life = life
    doc.npcs[0].background = background
    const loaded = World.load(doc)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.npcs()[0]!.life).toEqual(life)
    expect(loaded.value.npcs()[0]!.background).toEqual(background)
    // a person nobody wrote a life for stays as they were
    expect(hamlet().world.npcs()[0]!.life).toBeUndefined()
  })

  it('refuses a fact nothing can unlock, and more facts than one person carries', () => {
    const { world } = hamlet()
    const doc = docOf(world)
    doc.npcs[0].background = [{ fact: 'Something.', unlockedBy: 'bribed' }]
    expect(violationsOf(World.load(doc))).toContain('npcs.0.background.0.unlockedBy')

    doc.npcs[0].background = Array.from({ length: MAX_BACKGROUND_FACTS + 1 }, () => background[0])
    expect(violationsOf(World.load(doc))).toContain('npcs.0.background')

    doc.npcs[0].background = background
    doc.npcs[0].life = { ...life, history: 'x'.repeat(601) }
    expect(violationsOf(World.load(doc))).toContain('npcs.0.life.history')
  })
})

describe('the sizes everything is drawn and planned from', () => {
  it('sizes every piece of furniture once, at the height a body meets it', () => {
    for (const prop of FURNITURE_PROPS) {
      const spec = PROP_SPECS[prop]
      expect(spec.cells[0], prop).toBeGreaterThan(0)
      expect(spec.cells[1], prop).toBeGreaterThan(0)
      // a piece on a counter claims no floor, and a rug stops nobody
      if (spec.onSurface) expect(spec.blocks, prop).toBe(false)
    }
    expect(footprintOf('table')).toEqual({ width: 10 * PROP_CELL, depth: 10 * PROP_CELL })
    expect(PROP_SPECS.chair.contact).toEqual({ kind: 'rest', height: METRICS.furniture.seatHeight })
    expect(PROP_SPECS['bar-counter'].staffContact).toBe(METRICS.furniture.serviceCounterHeight)
    expect(PROP_SPECS.register.onSurface).toBe(true)
  })

  it('reads a plot in its door\'s frame and holds it to the band the city is cut in', () => {
    const rect = { x: 0, y: 0, w: 4, h: 6 }
    const south = plotShape({ rect, entrance: { cell: { x: 1, y: 6 }, facing: 'south' }, storeys: 2 })
    expect(south).toEqual({ frontage: 4, depth: 6, storeys: 2 })
    const east = plotShape({ rect, entrance: { cell: { x: 4, y: 2 }, facing: 'east' }, storeys: 2 })
    expect(east).toEqual({ frontage: 6, depth: 4, storeys: 2 })

    expect(inPlotBand(south)).toBe(true)
    expect(inPlotBand(east)).toBe(false)
    expect(inPlotBand({ frontage: PLOT_BAND.frontage.max, depth: PLOT_BAND.depth.min, storeys: PLOT_BAND.storeys.max })).toBe(true)
    expect(inPlotBand({ ...south, storeys: PLOT_BAND.storeys.max + 1 })).toBe(false)
  })
})
