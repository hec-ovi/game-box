import { describe, expect, it } from 'vitest'
import { World, type Interior, type Item, type Npc, type Placement } from '../src/index.ts'

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
