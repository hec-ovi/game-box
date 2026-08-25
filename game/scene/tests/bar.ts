import { World, type Anchor, type Furniture, type Interior, type Npc } from '@gb/world'

/** A world with one 8 by 8 bar in it, its street door at (4, 0), and whatever is standing about inside. */
export function bar(furniture: Furniture[], anchors: Anchor[] = [], npcs: Npc[] = []): { world: World; interior: Interior } {
  const world = World.create({ name: 'Facing', theme: 'test', seed: 'facing', width: 12, height: 12 })
  const plot = world.addPlot({
    kind: 'bar',
    name: 'The Anchor',
    rect: { x: 4, y: 4, w: 3, h: 3 },
    entrance: { cell: { x: 5, y: 3 }, facing: 'north' },
    storeys: 1,
    style: 'plain',
  })
  if (!plot.ok) throw new Error(plot.error.code)

  const interior: Interior = {
    id: 'interior_0001',
    plotId: plot.value.id,
    kind: 'bar',
    size: { w: 8, h: 8 },
    rooms: [{ id: 'room_0001', kind: 'main', name: 'Bar', rect: { x: 0, y: 0, w: 8, h: 8 } }],
    doors: [{ id: 'door_0001', from: 'outside', to: 'room_0001', pos: { x: 4, y: 0 }, rot: 180, locked: false }],
    furniture,
    anchors,
  }
  const added = world.addInterior(interior)
  if (!added.ok) throw new Error(added.error.code)
  for (const npc of npcs) {
    const put = world.addNpc(npc)
    if (!put.ok) throw new Error(put.error.code)
  }
  return { world, interior }
}
