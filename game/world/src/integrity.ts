import { Grid } from './grid.ts'
import type { WorldDoc } from './model/schema.ts'

/** One thing that is internally inconsistent, pointed at where it is. */
export interface IntegrityProblem {
  readonly where: string
  readonly message: string
}

/**
 * Everything a JSON Schema cannot say: that ids are unique, that every
 * reference points at something that exists, and that the grid agrees with the
 * plots drawn on it. A generated world that fails this is rejected whole.
 */
export function checkIntegrity(doc: WorldDoc): IntegrityProblem[] {
  const problems: IntegrityProblem[] = []
  const fail = (where: string, message: string) => problems.push({ where, message })

  const seen = new Set<string>()
  const claim = (where: string, id: string) => {
    if (seen.has(id)) fail(where, `duplicate id ${id}`)
    seen.add(id)
  }

  const plots = new Map(doc.plots.map((p) => [p.id, p]))
  const interiors = new Map(doc.interiors.map((i) => [i.id, i]))
  const npcs = new Map(doc.npcs.map((n) => [n.id, n]))
  const items = new Map(doc.items.map((i) => [i.id, i]))
  const nodes = new Set(doc.roads.nodes.map((n) => n.id))
  const catalogues = new Set((doc.catalogues ?? []).map((c) => c.pack))

  for (const plot of doc.plots) claim(`plot ${plot.id}`, plot.id)
  for (const interior of doc.interiors) claim(`interior ${interior.id}`, interior.id)
  for (const npc of doc.npcs) claim(`npc ${npc.id}`, npc.id)
  for (const item of doc.items) claim(`item ${item.id}`, item.id)
  for (const node of doc.roads.nodes) claim(`road node ${node.id}`, node.id)
  for (const segment of doc.roads.segments) claim(`road segment ${segment.id}`, segment.id)

  // grid shape and contents
  const { width, height, rows } = doc.grid
  if (rows.length !== height) fail('grid', `height is ${height} but there are ${rows.length} rows`)
  rows.forEach((row, y) => {
    if (row.length !== width) fail('grid', `row ${y} is ${row.length} cells, expected ${width}`)
  })
  const grid = Grid.fromRows(rows)
  for (let y = 0; y < Math.min(height, rows.length); y++) {
    for (let x = 0; x < Math.min(width, rows[y]!.length); x++) {
      if (grid.at(x, y) === undefined) fail('grid', `unknown cell char "${rows[y]![x]}" at ${x},${y}`)
    }
  }

  for (const plot of doc.plots) {
    const where = `plot ${plot.id}`
    const { x, y, w, h } = plot.rect
    if (x + w > width || y + h > height) fail(where, 'footprint falls outside the grid')
    else if (!grid.isAll(plot.rect, ['building'])) fail(where, 'footprint is not marked as building on the grid')

    const { cell } = plot.entrance
    const onEdge =
      cell.x >= x - 1 && cell.x <= x + w && cell.y >= y - 1 && cell.y <= y + h
    if (!onEdge) fail(where, 'entrance cell is not on the footprint edge')

    if (plot.design && !catalogues.has(plot.design.pack)) {
      fail(where, `design names catalogue ${plot.design.pack}, which this world does not record`)
    }

    if (plot.interiorId) {
      const interior = interiors.get(plot.interiorId)
      if (!interior) fail(where, `interiorId ${plot.interiorId} does not exist`)
      else if (interior.plotId !== plot.id) fail(where, `interior ${interior.id} points at plot ${interior.plotId}`)
      else if (interior.kind !== plot.kind) fail(where, `interior kind ${interior.kind} does not match plot kind ${plot.kind}`)
    }
  }

  for (const interior of doc.interiors) {
    const where = `interior ${interior.id}`
    const owner = plots.get(interior.plotId)
    if (!owner) fail(where, `plotId ${interior.plotId} does not exist`)
    else if (owner.interiorId !== interior.id) fail(where, `plot ${owner.id} does not point back at it`)

    const rooms = new Set(interior.rooms.map((r) => r.id))
    for (const room of interior.rooms) claim(`${where} room`, room.id)

    const entrances = interior.doors.filter((d) => d.from === 'outside')
    if (entrances.length !== 1) fail(where, `needs exactly one door from outside, found ${entrances.length}`)
    for (const door of interior.doors) {
      claim(`${where} door`, door.id)
      if (door.from !== 'outside' && !rooms.has(door.from)) fail(where, `door ${door.id} comes from unknown room ${door.from}`)
      if (!rooms.has(door.to)) fail(where, `door ${door.id} leads to unknown room ${door.to}`)
      if (door.keyItemId && !items.has(door.keyItemId)) fail(where, `door ${door.id} needs unknown key ${door.keyItemId}`)
      if (door.locked && !door.keyItemId) fail(where, `door ${door.id} is locked with no key item`)
    }

    const props = new Set(interior.furniture.map((f) => f.id))
    for (const piece of interior.furniture) {
      claim(`${where} furniture`, piece.id)
      if (!rooms.has(piece.roomId)) fail(where, `furniture ${piece.id} is in unknown room ${piece.roomId}`)
    }
    for (const anchor of interior.anchors) {
      claim(`${where} anchor`, anchor.id)
      if (!rooms.has(anchor.roomId)) fail(where, `anchor ${anchor.id} is in unknown room ${anchor.roomId}`)
      if (anchor.propId && !props.has(anchor.propId)) fail(where, `anchor ${anchor.id} references unknown prop ${anchor.propId}`)
    }
  }

  const takenAnchors = new Set<string>()
  for (const npc of doc.npcs) {
    const where = `npc ${npc.id}`
    if (npc.homePlotId && !plots.has(npc.homePlotId)) fail(where, `homePlotId ${npc.homePlotId} does not exist`)
    if (npc.workPlotId && !plots.has(npc.workPlotId)) fail(where, `workPlotId ${npc.workPlotId} does not exist`)
    if (npc.station) {
      const interior = interiors.get(npc.station.interiorId)
      if (!interior) {
        fail(where, `station interior ${npc.station.interiorId} does not exist`)
      } else if (!interior.anchors.some((a) => a.id === npc.station!.anchorId)) {
        fail(where, `station anchor ${npc.station.anchorId} is not in interior ${interior.id}`)
      }
      const key = `${npc.station.interiorId}/${npc.station.anchorId}`
      if (takenAnchors.has(key)) fail(where, `two NPCs are stationed on anchor ${key}`)
      takenAnchors.add(key)
    }
  }

  for (const item of doc.items) {
    if (item.ownerNpcId && !npcs.has(item.ownerNpcId)) {
      fail(`item ${item.id}`, `ownerNpcId ${item.ownerNpcId} does not exist`)
    }
  }

  const placed = new Set<string>()
  for (const placement of doc.placements) {
    const where = `placement of ${placement.itemId}`
    if (!items.has(placement.itemId)) fail(where, 'item does not exist')
    if (placed.has(placement.itemId)) fail(where, 'item is placed in two places')
    placed.add(placement.itemId)
    if (placement.at === 'npc' && !npcs.has(placement.npcId)) fail(where, `npc ${placement.npcId} does not exist`)
    if (placement.at === 'anchor') {
      const interior = interiors.get(placement.interiorId)
      if (!interior) fail(where, `interior ${placement.interiorId} does not exist`)
      else if (!interior.anchors.some((a) => a.id === placement.anchorId)) {
        fail(where, `anchor ${placement.anchorId} is not in interior ${interior.id}`)
      }
    }
    if (placement.at === 'ground' && !grid.inside(placement.cell.x, placement.cell.y)) {
      fail(where, 'ground cell is outside the grid')
    }
  }
  for (const item of doc.items) {
    if (!placed.has(item.id)) fail(`item ${item.id}`, 'exists but is nowhere in the world')
  }

  for (const segment of doc.roads.segments) {
    const where = `road segment ${segment.id}`
    if (!nodes.has(segment.from)) fail(where, `from node ${segment.from} does not exist`)
    if (!nodes.has(segment.to)) fail(where, `to node ${segment.to} does not exist`)
    if (segment.from === segment.to) fail(where, 'starts and ends at the same node')
  }

  return problems
}
